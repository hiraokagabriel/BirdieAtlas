import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { draws, matches, matchResults, tournamentCategories, tournamentRegistrations, tournaments } from '../db/schema.js'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { buildMatchDefs, buildSlots, getSlotForPosition } from '../domain/bracket.js'
import { awardTournamentPoints } from '../services/ranking-engine.js'
import { selectRegistrations } from '../db/registrations.js'

const upsertMatchResultSchema = z.object({
  sets: z.array(z.object({ setNumber: z.number(), score1: z.number(), score2: z.number() })),
  status: z.enum(['completed', 'walkover', 'retired']),
})

const scheduleMatchSchema = z.object({
  scheduledAt: z.string().nullable(),
  courtNumber: z.number().nullable(),
})

const generateDrawSchema = z.object({
  mode: z.enum(['random', 'seeded']).default('seeded'),
})

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}

export async function drawsRoutes(app: FastifyInstance) {
  app.get('/tournaments/categories/:categoryId/draws', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    return db.select().from(draws).where(eq(draws.categoryId, categoryId))
  })

  app.post('/draws/generate/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const { mode } = generateDrawSchema.parse(request.body ?? {})

    const confirmed = await selectRegistrations(and(eq(tournamentRegistrations.categoryId, categoryId), eq(tournamentRegistrations.status, 'approved')))
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 approved registrations' })

    const slots      = buildSlots(confirmed, mode)
    const [draw]     = await db.insert(draws).values({ id: randomUUID(), categoryId, drawMode: mode }).returning()
    const matchDefs  = buildMatchDefs(draw.id, slots)

    await db.insert(matches).values(matchDefs)
    return reply.status(201).send({ draw, matchCount: matchDefs.length, mode })
  })

  app.post('/draws/:drawId/redraw', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const { mode }   = generateDrawSchema.parse(request.body ?? {})

    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })

    // Block redraw when draw is published
    if (draw.published) {
      return reply.status(409).send({
        error: 'Cannot redraw a published draw. Unpublish it first.',
        code: 'DRAW_PUBLISHED',
      })
    }

    // Valida antes de apagar: uma refação que falha não pode destruir a chave atual.
    const confirmed = await selectRegistrations(and(eq(tournamentRegistrations.categoryId, draw.categoryId), eq(tournamentRegistrations.status, 'approved')))
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 approved registrations' })

    const slots     = buildSlots(confirmed, mode)
    const matchDefs = buildMatchDefs(drawId, slots)

    // Apagar a chave antiga e gravar a nova é uma operação só: ou troca inteira, ou nada.
    const updated = await db.transaction(async (tx) => {
      const existingMatches = await tx.select({ id: matches.id }).from(matches).where(eq(matches.drawId, drawId))
      const matchIds = existingMatches.map((m) => m.id)
      if (matchIds.length) {
        await tx.delete(matchResults).where(inArray(matchResults.matchId, matchIds))
      }
      await tx.delete(matches).where(eq(matches.drawId, drawId))
      await tx.insert(matches).values(matchDefs)

      const [row] = await tx.update(draws)
        .set({ drawMode: mode, published: false, generatedAt: new Date(), updatedAt: new Date() })
        .where(eq(draws.id, drawId))
        .returning()
      return row
    })

    return reply.status(200).send({ draw: updated, matchCount: matchDefs.length, mode })
  })

  app.post('/draws/:drawId/migrate-next-match-id', async (request) => {
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

  app.post('/draws/:drawId/publish', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: true, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  app.post('/draws/:drawId/unpublish', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: false, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  // Distribui os pontos do torneio pelas regras de pontos dos rankings (ver services/ranking-engine.ts)
  app.post('/tournaments/:tournamentId/award-points', async (request, reply) => {
    const { tournamentId } = request.params as { tournamentId: string }

    const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, tournamentId), isNull(tournaments.deletedAt)))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    if (tournament.pointsAwarded) {
      return reply.status(409).send({ error: 'Os pontos deste torneio já foram distribuídos.', code: 'POINTS_ALREADY_AWARDED' })
    }

    const result = await awardTournamentPoints(tournament)
    if (!result.ok) {
      const status = result.code === 'TOURNAMENT_NOT_FINISHED' ? 409 : 422
      return reply.status(status).send({ error: result.message, code: result.code, details: result.details })
    }
    return { awarded: result.awarded, rankings: result.rankings, skipped: result.skipped }
  })
  app.patch('/draws/matches/:matchId/schedule', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = scheduleMatchSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })
    const [updated] = await db.update(matches)
      .set({ scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, courtNumber: body.courtNumber, updatedAt: new Date() })
      .where(eq(matches.id, matchId)).returning()
    return updated
  })

  app.post('/draws/matches/:matchId/result', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = upsertMatchResultSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })

    // Torneio encerrado: mudar resultado deixaria final_placement e pontos desatualizados.
    const [owner] = await db.select({ status: tournaments.status })
      .from(draws)
      .innerJoin(tournamentCategories, eq(tournamentCategories.id, draws.categoryId))
      .innerJoin(tournaments, eq(tournaments.id, tournamentCategories.tournamentId))
      .where(and(eq(draws.id, match.drawId), isNull(tournaments.deletedAt)))
    if (owner && (owner.status === 'completed' || owner.status === 'cancelled')) {
      return reply.status(409).send({ error: 'O torneio está encerrado. Reabra-o para alterar resultados.', code: 'TOURNAMENT_LOCKED' })
    }

    const newWinner =getWinnerSlot(body.sets)
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
  await db.update(matches)
    .set({ [isSlot1 ? 'registration1Id' : 'registration2Id']: null, status: 'pending', updatedAt: new Date() })
    .where(eq(matches.id, matchId))
  if (match.nextMatchId && prevWinnerRegId) await cascadeReset(match.nextMatchId, prevWinnerRegId)
}
