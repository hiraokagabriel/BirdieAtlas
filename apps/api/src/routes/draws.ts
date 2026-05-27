import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { draws, matches, matchResults, tournamentRegistrations } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const upsertMatchResultSchema = z.object({
  sets: z.array(
    z.object({
      setNumber: z.number(),
      score1: z.number(),
      score2: z.number(),
    })
  ),
  status: z.enum(['completed', 'walkover', 'retired']),
})

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}

export async function drawsRoutes(app: FastifyInstance) {
  // Lista draws de uma categoria
  app.get('/tournaments/categories/:categoryId/draws', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    return db.select().from(draws).where(eq(draws.categoryId, categoryId))
  })

  // Gera chaveamento com nextMatchId populado
  app.post('/draws/generate/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }

    const registrations = await db
      .select()
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.categoryId, categoryId))

    const confirmed = registrations.filter((r) => r.confirmed && !r.withdrew)
    if (confirmed.length < 2)
      return reply.status(400).send({ error: 'Need at least 2 confirmed registrations' })

    const sorted = confirmed.sort((a, b) => {
      if (a.seed && b.seed) return a.seed - b.seed
      if (a.seed) return -1
      if (b.seed) return 1
      return (b.rankingPointsAtEntry ?? 0) - (a.rankingPointsAtEntry ?? 0)
    })

    const numEntries = sorted.length
    const numRounds = Math.ceil(Math.log2(numEntries))
    const bracketSize = Math.pow(2, numRounds)

    const [draw] = await db
      .insert(draws)
      .values({ id: randomUUID(), categoryId })
      .returning()

    // Gera IDs antecipadamente para poder linkar nextMatchId
    type MatchDef = {
      id: string
      drawId: string
      round: number
      position: number
      registration1Id: string | null
      registration2Id: string | null
      nextMatchId: string | null
      status: 'pending'
    }

    const matchDefs: MatchDef[] = []

    // Cria todas as partidas de todos os rounds com IDs pre-gerados
    for (let round = numRounds; round >= 1; round--) {
      const numMatchesInRound = round === numRounds ? bracketSize / 2 : Math.pow(2, round - 1)
      for (let pos = 1; pos <= numMatchesInRound; pos++) {
        matchDefs.push({
          id: randomUUID(),
          drawId: draw.id,
          round,
          position: pos,
          registration1Id: null,
          registration2Id: null,
          nextMatchId: null,
          status: 'pending',
        })
      }
    }

    // Preenche atletas no primeiro round (maior número)
    const firstRoundMatches = matchDefs.filter((m) => m.round === numRounds)
    for (let i = 0; i < firstRoundMatches.length; i++) {
      const pos = firstRoundMatches[i].position
      const idx1 = pos - 1
      const idx2 = bracketSize - pos
      firstRoundMatches[i].registration1Id = sorted[idx1]?.id ?? null
      firstRoundMatches[i].registration2Id = sorted[idx2]?.id ?? null
    }

    // Liga nextMatchId: vencedor de (round R, pos P) vai para (round R-1, pos ceil(P/2))
    for (const match of matchDefs) {
      if (match.round === 1) continue // final não tem próxima
      const nextRound = match.round - 1
      const nextPos = Math.ceil(match.position / 2)
      const next = matchDefs.find((m) => m.round === nextRound && m.position === nextPos)
      if (next) match.nextMatchId = next.id
    }

    await db.insert(matches).values(matchDefs)
    return reply.status(201).send({ draw, matchCount: matchDefs.length })
  })

  app.get('/draws/:drawId/matches', async (request) => {
    const { drawId } = request.params as { drawId: string }
    return db.select().from(matches).where(eq(matches.drawId, drawId))
  })

  // Cria ou edita resultado de uma partida com propagação em cascata
  app.post('/draws/matches/:matchId/result', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = upsertMatchResultSchema.parse(request.body)

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })

    const newWinner = getWinnerSlot(body.sets)
    if (!newWinner) return reply.status(400).send({ error: 'Cannot determine winner from sets' })

    const newWinnerRegId = newWinner === 1 ? match.registration1Id : match.registration2Id

    // Detecta se havia resultado anterior e se o vencedor mudou
    const prevResults = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
    const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
    const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id
    const winnerChanged = prevResults.length > 0 && prevWinnerRegId !== newWinnerRegId

    // Se vencedor mudou, reseta em cascata todas as partidas dependentes
    if (winnerChanged && match.nextMatchId) {
      await cascadeReset(match.nextMatchId, prevWinnerRegId)
    }

    // Apaga resultados antigos
    if (prevResults.length) {
      await db.delete(matchResults).where(eq(matchResults.matchId, matchId))
    }

    // Atualiza status da partida
    await db
      .update(matches)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(matches.id, matchId))

    // Insere novos parciais
    const results = await db
      .insert(matchResults)
      .values(
        body.sets.map((s) => ({
          id: randomUUID(),
          matchId,
          setNumber: s.setNumber,
          score1: s.score1,
          score2: s.score2,
        }))
      )
      .returning()

    // Avança o vencedor para a próxima partida
    if (match.nextMatchId) {
      const [nextMatch] = await db.select().from(matches).where(eq(matches.id, match.nextMatchId))
      if (nextMatch) {
        // Slot: partidas em posição ímpar alimentam slot 1, par alimentam slot 2
        const slot = match.position % 2 === 1 ? 'registration1Id' : 'registration2Id'
        await db
          .update(matches)
          .set({ [slot]: newWinnerRegId, updatedAt: new Date() })
          .where(eq(matches.id, match.nextMatchId))
      }
    }

    return { match: { ...match, status: body.status }, results }
  })

  app.get('/draws/matches/:matchId/result', async (request) => {
    const { matchId } = request.params as { matchId: string }
    return db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  })
}

// Reseta em cascata: remove o regId do slot correspondente e limpa resultados
async function cascadeReset(matchId: string, regIdToRemove: string | null): Promise<void> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!match) return

  // Remove o atleta do slot correto
  const isSlot1 = match.registration1Id === regIdToRemove
  const isSlot2 = match.registration2Id === regIdToRemove

  if (!isSlot1 && !isSlot2) return // atleta não está nessa partida, para cascata

  // Apaga resultados dessa partida
  const prevResults = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
  const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id

  await db.delete(matchResults).where(eq(matchResults.matchId, matchId))

  // Reseta o slot e o status
  await db
    .update(matches)
    .set({
      [isSlot1 ? 'registration1Id' : 'registration2Id']: null,
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId))

  // Propaga para próxima se havia um vencedor que avançou
  if (match.nextMatchId && prevWinnerRegId) {
    await cascadeReset(match.nextMatchId, prevWinnerRegId)
  }
}
