import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { rankings, rankingEntries, athletes, tenants } from '../db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'

// Gender compatibility check (mirrors draws.ts)
function isGenderCompatible(discipline: string, gender1: 'M' | 'F', gender2?: 'M' | 'F'): boolean {
  if (discipline === 'MS' || discipline === 'MD') return gender1 === 'M' && (gender2 === undefined || gender2 === 'M')
  if (discipline === 'WS' || discipline === 'WD') return gender1 === 'F' && (gender2 === undefined || gender2 === 'F')
  if (discipline === 'XD') {
    if (!gender2) return false
    return (gender1 === 'M' && gender2 === 'F') || (gender1 === 'F' && gender2 === 'M')
  }
  return true
}

export async function rankingsRoutes(app: FastifyInstance) {
  // Lista rankings de um tenant
  app.get('/rankings', async (request) => {
    const { tenantId, tenantSlug } = request.query as { tenantId?: string; tenantSlug?: string }

    if (tenantSlug) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug))
      if (!tenant) return []
      return db.select().from(rankings).where(and(eq(rankings.tenantId, tenant.id), eq(rankings.active, true)))
    }

    if (tenantId) {
      return db.select().from(rankings).where(and(eq(rankings.tenantId, tenantId), eq(rankings.active, true)))
    }

    return db.select().from(rankings)
  })

  // Entradas de um ranking com dados dos atletas (join)
  app.get('/rankings/:rankingId/entries', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    const { page = '1', perPage = '50' } = request.query as { page?: string; perPage?: string }
    const pageNum    = Math.max(1, parseInt(page))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)))
    const offset = (pageNum - 1) * perPageNum

    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })

    const entries = await db
      .select()
      .from(rankingEntries)
      .where(eq(rankingEntries.rankingId, rankingId))
      .orderBy(asc(rankingEntries.position))
      .limit(perPageNum)
      .offset(offset)

    const athleteIds = [...new Set(entries.flatMap((e) => [e.athleteId, e.athlete2Id].filter(Boolean) as string[]))]

    const athleteList = athleteIds.length
      ? await db.select().from(athletes).where(
          athleteIds.length === 1
            ? eq(athletes.id, athleteIds[0])
            : inArray(athletes.id, athleteIds)
        )
      : []

    const athleteMap = new Map(athleteList.map((a) => [a.id, a]))

    const enriched = entries.map((e) => ({
      ...e,
      athlete: athleteMap.get(e.athleteId) ?? null,
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

  // ---------------------------------------------------------------------------
  // Auditoria de gênero: remove entradas inválidas e recalcula posições
  // POST /rankings/audit-gender
  // ---------------------------------------------------------------------------
  app.post('/rankings/audit-gender', async (_request, _reply) => {
    const allRankings = await db.select().from(rankings)
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

      // Remove entradas inválidas
      if (toRemove.length) {
        await db.delete(rankingEntries).where(inArray(rankingEntries.id, toRemove))
      }

      // Recalcula posições das entradas válidas mantendo ordenação por pontos
      const sorted = [...toKeep].sort((a, b) => b.points - a.points)
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
