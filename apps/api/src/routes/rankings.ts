import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import {
  rankings, rankingEntries, rankingTournaments,
  athletes, tenants, tournaments,
  tournamentCategories, draws, matches, matchResults, tournamentRegistrations,
  pointsTables,
} from '../db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isGenderCompatible(discipline: string, gender1: 'M' | 'F', gender2?: 'M' | 'F'): boolean {
  if (discipline === 'MS' || discipline === 'MD') return gender1 === 'M' && (gender2 === undefined || gender2 === 'M')
  if (discipline === 'WS' || discipline === 'WD') return gender1 === 'F' && (gender2 === undefined || gender2 === 'F')
  if (discipline === 'XD') {
    if (!gender2) return false
    return (gender1 === 'M' && gender2 === 'F') || (gender1 === 'F' && gender2 === 'M')
  }
  return true
}

const DOUBLES_DISCIPLINES = new Set(['MD', 'WD', 'XD'])

function normalizePair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1]
}

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const w1 = sets.filter((s) => s.score1 > s.score2).length
  const w2 = sets.filter((s) => s.score2 > s.score1).length
  return w1 > w2 ? 1 : w2 > w1 ? 2 : null
}

function isByeMatch(match: { registration1Id: string | null; registration2Id: string | null }): boolean {
  return match.registration1Id === null || match.registration2Id === null
}

function getWinnerLoserFromSlots(
  match: { registration1Id: string | null; registration2Id: string | null; status: string },
): { winnerRegId: string; loserRegId: string | null } | null {
  const { registration1Id, registration2Id, status } = match
  if (registration2Id === null && registration1Id !== null) return { winnerRegId: registration1Id, loserRegId: null }
  if (registration1Id === null && registration2Id !== null) return { winnerRegId: registration2Id, loserRegId: null }
  if ((status === 'walkover' || status === 'retired') && registration1Id && registration2Id) {
    return { winnerRegId: registration1Id, loserRegId: registration2Id }
  }
  return null
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createRankingSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  discipline: z.enum(['MS', 'WS', 'MD', 'WD', 'XD']),
  year: z.number().int(),
  autoInclude: z.boolean().default(false),
  countBestResults: z.number().int().optional(),
  minTournamentsRequired: z.number().int().default(0),
  isPublic: z.boolean().default(true),
})

// ---------------------------------------------------------------------------
// Core: recalculate a ranking from scratch using its linked tournaments
// ---------------------------------------------------------------------------
async function recalculateRanking(rankingId: string) {
  const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
  if (!ranking) throw new Error('Ranking not found')

  let tournamentIds: string[] = []

  if (ranking.autoInclude) {
    const allTournaments = await db.select().from(tournaments)
      .where(and(eq(tournaments.tenantId, ranking.tenantId), eq(tournaments.pointsAwarded, true)))
    tournamentIds = allTournaments.map((t) => t.id)
  } else {
    const links = await db.select().from(rankingTournaments)
      .where(eq(rankingTournaments.rankingId, rankingId))
    tournamentIds = links.map((l) => l.tournamentId)
  }

  await db.delete(rankingEntries).where(eq(rankingEntries.rankingId, rankingId))

  if (!tournamentIds.length) return { recalculated: 0 }

  const isDoubles = DOUBLES_DISCIPLINES.has(ranking.discipline)
  const pointsAcc = new Map<string, { athleteId: string; athlete2Id: string | null; points: number }>()

  for (const tournamentId of tournamentIds) {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!tournament || !tournament.pointsTableId) continue

    const [refTable] = await db.select().from(pointsTables).where(eq(pointsTables.id, tournament.pointsTableId))
    if (!refTable) continue

    const allPointsRows = await db.select().from(pointsTables)
      .where(and(eq(pointsTables.name, refTable.name), eq(pointsTables.tournamentLevel, tournament.level)))
    const pointsMap = new Map(allPointsRows.map((p) => [p.placement, p.points]))

    const categories = await db.select().from(tournamentCategories)
      .where(and(
        eq(tournamentCategories.tournamentId, tournamentId),
        eq(tournamentCategories.discipline, ranking.discipline as any),
      ))

    for (const category of categories) {
      const drawList = await db.select().from(draws).where(eq(draws.categoryId, category.id))
      if (!drawList.length) continue

      const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawList[0].id))

      const pendingMatches = allMatches.filter(
        (m) => !['completed', 'walkover', 'retired'].includes(m.status) && !isByeMatch(m),
      )
      if (pendingMatches.length > 0) continue

      const placementByReg = new Map<string, number>()

      for (const match of allMatches) {
        if (match.registration1Id === null && match.registration2Id === null) continue

        const sets = await db.select().from(matchResults).where(eq(matchResults.matchId, match.id))

        let winnerRegId: string | null = null
        let loserRegId: string | null = null

        if (sets.length > 0 && match.status === 'completed') {
          const winner = getWinnerSlot(sets)
          if (!winner) continue
          winnerRegId = winner === 1 ? match.registration1Id : match.registration2Id
          loserRegId  = winner === 1 ? match.registration2Id : match.registration1Id
        } else {
          const result = getWinnerLoserFromSlots(match)
          if (!result) continue
          winnerRegId = result.winnerRegId
          loserRegId  = result.loserRegId
        }

        const loserPlacement = match.round === 1 ? 2 : Math.pow(2, match.round - 1) + 1
        if (loserRegId) placementByReg.set(loserRegId, loserPlacement)
        if (match.round === 1 && winnerRegId) placementByReg.set(winnerRegId, 1)
      }

      const regIds = [...placementByReg.keys()]
      if (!regIds.length) continue

      const regs = await db.select().from(tournamentRegistrations).where(inArray(tournamentRegistrations.id, regIds))
      const allAthleteIds = [...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
      const athleteRows = allAthleteIds.length ? await db.select().from(athletes).where(inArray(athletes.id, allAthleteIds)) : []
      const athleteMap = new Map(athleteRows.map((a) => [a.id, a]))

      for (const [regId, placement] of placementByReg.entries()) {
        const reg = regs.find((r) => r.id === regId)
        if (!reg) continue
        const a1 = athleteMap.get(reg.athleteId)
        const a2 = reg.athlete2Id ? athleteMap.get(reg.athlete2Id) : undefined
        if (!a1) continue
        if (!isGenderCompatible(ranking.discipline, a1.gender, a2?.gender)) continue

        const pts = pointsMap.get(placement) ?? 0
        if (pts === 0) continue

        if (isDoubles) {
          if (!reg.athlete2Id) continue
          const [normA1, normA2] = normalizePair(reg.athleteId, reg.athlete2Id)
          const key = `${normA1}::${normA2}`
          const cur = pointsAcc.get(key) ?? { athleteId: normA1, athlete2Id: normA2, points: 0 }
          cur.points += pts
          pointsAcc.set(key, cur)
        } else {
          const key = reg.athleteId
          const cur = pointsAcc.get(key) ?? { athleteId: reg.athleteId, athlete2Id: null, points: 0 }
          cur.points += pts
          pointsAcc.set(key, cur)
        }
      }
    }
  }

  const sorted = [...pointsAcc.values()].sort((a, b) => b.points - a.points)
  if (sorted.length) {
    await db.insert(rankingEntries).values(
      sorted.map((e, i) => ({
        id: randomUUID(),
        rankingId,
        athleteId: e.athleteId,
        athlete2Id: e.athlete2Id,
        totalPoints: e.points,
        position: i + 1,
      }))
    )
  }

  await db.update(rankings)
    .set({ lastCalculatedAt: new Date(), updatedAt: new Date() })
    .where(eq(rankings.id, rankingId))

  return { recalculated: sorted.length }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export async function rankingsRoutes(app: FastifyInstance) {

  // GET /rankings?tenantId=...&tenantSlug=...
  app.get('/rankings', async (request) => {
    const { tenantId, tenantSlug } = request.query as { tenantId?: string; tenantSlug?: string }

    if (tenantSlug) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug))
      if (!tenant) return []
      return db.select().from(rankings)
        .where(and(eq(rankings.tenantId, tenant.id), eq(rankings.status, 'active')))
    }

    if (tenantId) {
      return db.select().from(rankings)
        .where(and(eq(rankings.tenantId, tenantId), eq(rankings.status, 'active')))
    }

    return db.select().from(rankings)
  })

  app.get('/rankings/:rankingId', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })
    return ranking
  })

  app.post('/rankings', async (request, reply) => {
    const body = createRankingSchema.parse(request.body)
    const [ranking] = await db.insert(rankings).values({
      id: randomUUID(),
      ...body,
      status: 'active',
    }).returning()
    return reply.status(201).send(ranking)
  })

  app.put('/rankings/:rankingId', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    const body = createRankingSchema.partial().parse(request.body)
    const [ranking] = await db.update(rankings)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(rankings.id, rankingId))
      .returning()
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })
    return ranking
  })

  // Soft-delete: marca como inativo em vez de deletar fisicamente
  app.delete('/rankings/:rankingId', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    await db.update(rankings)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(rankings.id, rankingId))
    return reply.status(204).send()
  })

  app.get('/rankings/:rankingId/tournaments', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    const links = await db.select().from(rankingTournaments)
      .where(eq(rankingTournaments.rankingId, rankingId))
    if (!links.length) return []
    const tIds = links.map((l) => l.tournamentId)
    return db.select().from(tournaments).where(inArray(tournaments.id, tIds))
  })

  app.post('/rankings/:rankingId/tournaments/:tournamentId', async (request, reply) => {
    const { rankingId, tournamentId } = request.params as { rankingId: string; tournamentId: string }
    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    const existing = await db.select().from(rankingTournaments)
      .where(and(eq(rankingTournaments.rankingId, rankingId), eq(rankingTournaments.tournamentId, tournamentId)))
    if (existing.length) return existing[0]
    const [link] = await db.insert(rankingTournaments)
      .values({ id: randomUUID(), rankingId, tournamentId, isScoring: true })
      .returning()
    return reply.status(201).send(link)
  })

  app.delete('/rankings/:rankingId/tournaments/:tournamentId', async (request, reply) => {
    const { rankingId, tournamentId } = request.params as { rankingId: string; tournamentId: string }
    await db.delete(rankingTournaments)
      .where(and(eq(rankingTournaments.rankingId, rankingId), eq(rankingTournaments.tournamentId, tournamentId)))
    return reply.status(204).send()
  })

  app.post('/rankings/:rankingId/recalculate', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    try {
      const result = await recalculateRanking(rankingId)
      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return reply.status(400).send({ error: message })
    }
  })

  app.get('/rankings/:rankingId/entries', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    const { page = '1', perPage = '50' } = request.query as { page?: string; perPage?: string }
    const pageNum    = Math.max(1, parseInt(page))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)))
    const offset = (pageNum - 1) * perPageNum

    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })

    const entries = await db.select().from(rankingEntries)
      .where(eq(rankingEntries.rankingId, rankingId))
      .orderBy(asc(rankingEntries.position))
      .limit(perPageNum)
      .offset(offset)

    const athleteIds = [...new Set(entries.flatMap((e) => [e.athleteId, e.athlete2Id].filter(Boolean) as string[]))]
    const athleteList = athleteIds.length
      ? await db.select().from(athletes).where(inArray(athletes.id, athleteIds))
      : []
    const athleteMap = new Map(athleteList.map((a) => [a.id, a]))

    const enriched = entries.map((e) => ({
      ...e,
      athlete:  athleteMap.get(e.athleteId) ?? null,
      athlete2: e.athlete2Id ? (athleteMap.get(e.athlete2Id) ?? null) : null,
    }))

    const allEntries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, rankingId))
    const total = allEntries.length

    return {
      ranking,
      entries: enriched,
      pagination: { page: pageNum, perPage: perPageNum, total, totalPages: Math.ceil(total / perPageNum) },
    }
  })

  app.post('/rankings/audit-gender', async (_request, _reply) => {
    const allRankings = await db.select().from(rankings)
      .where(eq(rankings.status, 'active'))
    const report: { rankingId: string; discipline: string; removed: string[]; kept: number }[] = []

    for (const ranking of allRankings) {
      const entries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, ranking.id))
      if (!entries.length) continue

      const athleteIds = [...new Set(entries.flatMap((e) => [e.athleteId, e.athlete2Id].filter(Boolean) as string[]))]
      const athleteList = await db.select().from(athletes).where(inArray(athletes.id, athleteIds))
      const athleteMap = new Map(athleteList.map((a) => [a.id, a]))

      const toRemove: string[] = []
      const toKeep: typeof entries = []

      for (const entry of entries) {
        const a1 = athleteMap.get(entry.athleteId)
        const a2 = entry.athlete2Id ? athleteMap.get(entry.athlete2Id) : undefined
        if (!a1) { toRemove.push(entry.id); continue }
        if (!isGenderCompatible(ranking.discipline, a1.gender, a2?.gender)) {
          toRemove.push(entry.id)
        } else {
          toKeep.push(entry)
        }
      }

      if (toRemove.length) {
        await db.delete(rankingEntries).where(inArray(rankingEntries.id, toRemove))
      }

      const sorted = [...toKeep].sort((a, b) => b.totalPoints - a.totalPoints)
      for (let i = 0; i < sorted.length; i++) {
        await db.update(rankingEntries)
          .set({ position: i + 1, updatedAt: new Date() })
          .where(eq(rankingEntries.id, sorted[i].id))
      }

      report.push({ rankingId: ranking.id, discipline: ranking.discipline, removed: toRemove, kept: toKeep.length })
    }

    return { audited: allRankings.length, report }
  })
}
