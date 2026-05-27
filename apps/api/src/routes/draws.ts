import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { draws, matches, matchResults, tournamentRegistrations, rankingEntries, pointsTables, tournamentCategories, tournaments, rankings } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
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

  // ---------------------------------------------------------------------------
  // Distribuir pontos de ranking
  // Idempotente: bloqueia se pointsAwarded já for true no torneio
  // ---------------------------------------------------------------------------
  app.post('/tournaments/:tournamentId/award-points', async (request, reply) => {
    const { tournamentId } = request.params as { tournamentId: string }

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })

    // Idempotency guard
    if (tournament.pointsAwarded) {
      return reply.status(409).send({ error: 'Points have already been awarded for this tournament' })
    }

    if (!tournament.pointsTableId) return reply.status(400).send({ error: 'Tournament has no pointsTableId configured' })

    const [refTable] = await db.select().from(pointsTables).where(eq(pointsTables.id, tournament.pointsTableId))
    if (!refTable) return reply.status(400).send({ error: 'Points table not found' })

    const allPointsRows = await db.select().from(pointsTables)
      .where(and(eq(pointsTables.name, refTable.name), eq(pointsTables.tournamentLevel, tournament.level)))
    if (!allPointsRows.length) return reply.status(400).send({ error: 'Points table rows not found' })

    const pointsMap = new Map(allPointsRows.map((p) => [p.placement, p.points]))

    const tenantRankings = await db.select().from(rankings).where(eq(rankings.tenantId, tournament.tenantId))
    const rankingByDiscipline = new Map(tenantRankings.map((r) => [r.discipline, r]))

    const categories = await db.select().from(tournamentCategories).where(eq(tournamentCategories.tournamentId, tournamentId))

    const awarded: { categoryName: string; registrationId: string; athleteId: string; athlete2Id: string | null; placement: number; points: number }[] = []
    const skipped: { categoryName: string; reason: string }[] = []

    for (const category of categories) {
      const ranking = rankingByDiscipline.get(category.discipline)
      if (!ranking) {
        skipped.push({ categoryName: category.name, reason: `No ranking found for discipline ${category.discipline}` })
        continue
      }

      const drawList = await db.select().from(draws).where(eq(draws.categoryId, category.id))
      if (!drawList.length) {
        skipped.push({ categoryName: category.name, reason: 'No draw generated' })
        continue
      }
      const draw = drawList[0]

      const allMatches = await db.select().from(matches).where(eq(matches.drawId, draw.id))
      const completedStatuses = ['completed', 'walkover', 'retired']
      const pendingMatches = allMatches.filter((m) => !completedStatuses.includes(m.status))
      if (pendingMatches.length > 0) {
        skipped.push({ categoryName: category.name, reason: `${pendingMatches.length} match(es) still pending` })
        continue
      }

      const placementByReg = new Map<string, number>()

      for (const match of allMatches) {
        const sets = await db.select().from(matchResults).where(eq(matchResults.matchId, match.id))
        if (!sets.length) continue
        const winner = getWinnerSlot(sets)
        if (!winner) continue

        const loserRegId = winner === 1 ? match.registration2Id : match.registration1Id
        const winnerRegId = winner === 1 ? match.registration1Id : match.registration2Id

        const loserPlacement = match.round === 1 ? 2 : Math.pow(2, match.round - 1) + 1
        if (loserRegId) placementByReg.set(loserRegId, loserPlacement)
        if (match.round === 1 && winnerRegId) placementByReg.set(winnerRegId, 1)
      }

      const regIds = [...placementByReg.keys()]
      if (!regIds.length) continue
      const regs = await db.select().from(tournamentRegistrations).where(inArray(tournamentRegistrations.id, regIds))

      for (const [regId, placement] of placementByReg.entries()) {
        const reg = regs.find((r) => r.id === regId)
        if (!reg) continue
        const points = pointsMap.get(placement) ?? 0
        if (points === 0) continue

        const existing = await db.select().from(rankingEntries)
          .where(and(eq(rankingEntries.rankingId, ranking.id), eq(rankingEntries.athleteId, reg.athleteId)))

        if (existing.length) {
          await db.update(rankingEntries)
            .set({ points: existing[0].points + points, updatedAt: new Date() })
            .where(eq(rankingEntries.id, existing[0].id))
        } else {
          await db.insert(rankingEntries).values({
            id: randomUUID(),
            rankingId: ranking.id,
            athleteId: reg.athleteId,
            athlete2Id: reg.athlete2Id ?? null,
            points,
            position: 0,
          })
        }

        awarded.push({ categoryName: category.name, registrationId: regId, athleteId: reg.athleteId, athlete2Id: reg.athlete2Id ?? null, placement, points })
      }

      const allEntries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, ranking.id))
      const sorted = [...allEntries].sort((a, b) => b.points - a.points)
      for (let i = 0; i < sorted.length; i++) {
        await db.update(rankingEntries).set({ position: i + 1, updatedAt: new Date() }).where(eq(rankingEntries.id, sorted[i].id))
      }
    }

    // Marca torneio como pontos distribuídos — impede execução dupla
    await db.update(tournaments)
      .set({ pointsAwarded: true, updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId))

    return { awarded, skipped }
  })

  app.patch('/draws/matches/:matchId/schedule', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = scheduleMatchSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })
    const [updated] = await db
      .update(matches)
      .set({ scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, courtNumber: body.courtNumber, updatedAt: new Date() })
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
  await db.update(matches)
    .set({ [isSlot1 ? 'registration1Id' : 'registration2Id']: null, status: 'pending', updatedAt: new Date() })
    .where(eq(matches.id, matchId))
  if (match.nextMatchId && prevWinnerRegId) await cascadeReset(match.nextMatchId, prevWinnerRegId)
}
