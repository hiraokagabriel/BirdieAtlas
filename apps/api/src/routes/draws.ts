import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { draws, matches, matchResults, tournamentRegistrations } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const upsertMatchResultSchema = z.object({
  sets: z.array(z.object({ setNumber: z.number(), score1: z.number(), score2: z.number() })),
  status: z.enum(['completed', 'walkover', 'retired']),
})

const scheduleMatchSchema = z.object({
  scheduledAt: z.string().nullable(),
  courtNumber: z.number().nullable(),
})

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}

function getSlotForPosition(position: number): 'registration1Id' | 'registration2Id' {
  return position % 2 === 1 ? 'registration1Id' : 'registration2Id'
}

export async function drawsRoutes(app: FastifyInstance) {
  app.get('/tournaments/categories/:categoryId/draws', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    return db.select().from(draws).where(eq(draws.categoryId, categoryId))
  })

  app.post('/draws/generate/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const registrations = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.categoryId, categoryId))
    const confirmed = registrations.filter((r) => r.confirmed && !r.withdrew)
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 confirmed registrations' })

    const sorted = confirmed.sort((a, b) => {
      if (a.seed && b.seed) return a.seed - b.seed
      if (a.seed) return -1
      if (b.seed) return 1
      return (b.rankingPointsAtEntry ?? 0) - (a.rankingPointsAtEntry ?? 0)
    })

    const numRounds = Math.ceil(Math.log2(sorted.length))
    const bracketSize = Math.pow(2, numRounds)
    const [draw] = await db.insert(draws).values({ id: randomUUID(), categoryId }).returning()

    type MatchDef = { id: string; drawId: string; round: number; position: number; registration1Id: string | null; registration2Id: string | null; nextMatchId: string | null; status: 'pending' }
    const matchDefs: MatchDef[] = []

    for (let round = numRounds; round >= 1; round--) {
      const count = Math.pow(2, round - 1)
      for (let pos = 1; pos <= count; pos++) {
        matchDefs.push({ id: randomUUID(), drawId: draw.id, round, position: pos, registration1Id: null, registration2Id: null, nextMatchId: null, status: 'pending' })
      }
    }

    const firstRoundMatches = matchDefs.filter((m) => m.round === numRounds)
    for (const fm of firstRoundMatches) {
      fm.registration1Id = sorted[fm.position - 1]?.id ?? null
      fm.registration2Id = sorted[bracketSize - fm.position]?.id ?? null
    }

    for (const match of matchDefs) {
      if (match.round === 1) continue
      const next = matchDefs.find((m) => m.round === match.round - 1 && m.position === Math.ceil(match.position / 2))
      if (next) match.nextMatchId = next.id
    }

    await db.insert(matches).values(matchDefs)
    return reply.status(201).send({ draw, matchCount: matchDefs.length })
  })

  app.post('/draws/:drawId/migrate-next-match-id', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawId))
    let updated = 0
    for (const match of allMatches) {
      if (match.round === 1) continue
      const next = allMatches.find((m) => m.round === match.round - 1 && m.position === Math.ceil(match.position / 2))
      if (next && match.nextMatchId !== next.id) {
        await db.update(matches).set({ nextMatchId: next.id }).where(eq(matches.id, match.id))
        updated++
      }
    }
    return { updated, total: allMatches.length }
  })

  app.get('/draws/:drawId/matches', async (request) => {
    const { drawId } = request.params as { drawId: string }
    return db.select().from(matches).where(eq(matches.drawId, drawId))
  })

  // Agendamento de partida
  app.patch('/draws/matches/:matchId/schedule', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = scheduleMatchSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })
    const [updated] = await db
      .update(matches)
      .set({
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        courtNumber: body.courtNumber,
        updatedAt: new Date(),
      })
      .where(eq(matches.id, matchId))
      .returning()
    return updated
  })

  app.post('/draws/matches/:matchId/result', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = upsertMatchResultSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })

    const newWinner = getWinnerSlot(body.sets)
    if (!newWinner) return reply.status(400).send({ error: 'Cannot determine winner from sets' })
    const newWinnerRegId = newWinner === 1 ? match.registration1Id : match.registration2Id

    const prevResults = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
    const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
    const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id
    const winnerChanged = prevResults.length > 0 && prevWinnerRegId !== newWinnerRegId

    if (winnerChanged && match.nextMatchId) await cascadeReset(match.nextMatchId, prevWinnerRegId)
    if (prevResults.length) await db.delete(matchResults).where(eq(matchResults.matchId, matchId))

    await db.update(matches).set({ status: body.status, updatedAt: new Date() }).where(eq(matches.id, matchId))

    const results = await db.insert(matchResults).values(
      body.sets.map((s) => ({ id: randomUUID(), matchId, setNumber: s.setNumber, score1: s.score1, score2: s.score2 }))
    ).returning()

    if (match.nextMatchId) {
      const slot = getSlotForPosition(match.position)
      await db.update(matches).set({ [slot]: newWinnerRegId, updatedAt: new Date() }).where(eq(matches.id, match.nextMatchId))
    }

    return { match: { ...match, status: body.status }, results }
  })

  app.get('/draws/matches/:matchId/result', async (request) => {
    const { matchId } = request.params as { matchId: string }
    return db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  })
}

async function cascadeReset(matchId: string, regIdToRemove: string | null): Promise<void> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!match) return
  const isSlot1 = match.registration1Id === regIdToRemove
  const isSlot2 = match.registration2Id === regIdToRemove
  if (!isSlot1 && !isSlot2) return
  const prevResults = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
  const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id
  await db.delete(matchResults).where(eq(matchResults.matchId, matchId))
  await db.update(matches).set({ [isSlot1 ? 'registration1Id' : 'registration2Id']: null, status: 'pending', updatedAt: new Date() }).where(eq(matches.id, matchId))
  if (match.nextMatchId && prevWinnerRegId) await cascadeReset(match.nextMatchId, prevWinnerRegId)
}

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}
