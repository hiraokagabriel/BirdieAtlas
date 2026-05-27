import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { rankings, rankingEntries, athletes, tenants } from '../db/schema'
import { eq, and, asc } from 'drizzle-orm'

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

    // Busca entries ordenadas por posição
    const entries = await db
      .select()
      .from(rankingEntries)
      .where(eq(rankingEntries.rankingId, rankingId))
      .orderBy(asc(rankingEntries.position))
      .limit(perPageNum)
      .offset(offset)

    // Coleta IDs únicos de atletas
    const athleteIds = [...new Set(entries.flatMap((e) => [e.athleteId, e.athlete2Id].filter(Boolean) as string[]))]

    const athleteList = athleteIds.length
      ? await db.select().from(athletes).where(
          athleteIds.length === 1
            ? eq(athletes.id, athleteIds[0])
            : (() => { const { inArray } = require('drizzle-orm'); return inArray(athletes.id, athleteIds) })()
        )
      : []

    const athleteMap = new Map(athleteList.map((a) => [a.id, a]))

    const enriched = entries.map((e) => ({
      ...e,
      athlete: athleteMap.get(e.athleteId) ?? null,
      athlete2: e.athlete2Id ? (athleteMap.get(e.athlete2Id) ?? null) : null,
    }))

    // Total para paginação
    const allEntries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, rankingId))
    const total = allEntries.length

    return {
      ranking,
      entries: enriched,
      pagination: { page: pageNum, perPage: perPageNum, total, totalPages: Math.ceil(total / perPageNum) },
    }
  })
}
