import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { rankings, rankingEntries, rankingTournaments, athletes, tenants, tournaments } from '../db/schema.js'
import { eq, and, asc, desc, inArray, count } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { paginationQuerySchema } from '@birdie-atlas/validators'
import { publicAthleteColumns } from '../db/public-columns.js'
import { isGenderCompatible } from '../domain/eligibility.js'
import { buildCsv, csvAttachmentHeader } from '../domain/csv.js'
import { paginate } from '../domain/pagination.js'
import { recalculateRanking } from '../services/ranking-engine.js'
import { getDefaultTenantId } from '../tenant.js'

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
const listRankingsQuerySchema = paginationQuerySchema.extend({
  tenantSlug: z.string().trim().min(1).optional(),
})

const createRankingSchema = z.object({
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

/** Nome-base do CSV: evita "ranking-ranking-..." e repetir o ano que o nome já traz. */
function rankingFileBase(name: string, year: number): string {
  const withKind = /ranking/i.test(name) ? name : `ranking ${name}`
  return withKind.includes(String(year)) ? withKind : `${withKind} ${year}`
}

export async function rankingsRoutes(app: FastifyInstance) {

  // Com `tenantSlug` (portal público): rankings ativos e públicos daquele tenant.
  // Sem ele (admin): todos os rankings do tenant padrão.
  app.get('/rankings', async (request, reply) => {
    const query = listRankingsQuerySchema.parse(request.query)

    let where
    if (query.tenantSlug) {
      const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, query.tenantSlug))
      if (!tenant) return reply.status(404).send({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' })
      where = and(eq(rankings.tenantId, tenant.id), eq(rankings.status, 'active'), eq(rankings.isPublic, true))
    } else {
      where = eq(rankings.tenantId, await getDefaultTenantId())
    }

    return paginate(
      query,
      (limit, offset) =>
        db.select().from(rankings).where(where)
          .orderBy(desc(rankings.year), asc(rankings.discipline), asc(rankings.id))
          .limit(limit).offset(offset),
      async () => (await db.select({ total: count() }).from(rankings).where(where))[0]?.total ?? 0,
    )
  })

  app.get('/rankings/:rankingId', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })
    return ranking
  })

  app.post('/rankings', async (request, reply) => {
    const body = createRankingSchema.parse(request.body)
    const tenantId = await getDefaultTenantId()
    const [ranking] = await db.insert(rankings).values({
      id: randomUUID(),
      tenantId,
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
    if (tournament.kind === 'friendly') {
      return reply.status(422).send({ error: 'Torneio amistoso não pode ser vinculado a um ranking.', code: 'FRIENDLY_TOURNAMENT' })
    }
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

  // Público: atletas saem só com colunas públicas (sem e-mail/data de nascimento).
  app.get('/rankings/:rankingId/entries', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }
    const query = paginationQuerySchema.parse(request.query)

    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })

    const where = eq(rankingEntries.rankingId, rankingId)
    const page = await paginate(
      query,
      async (limit, offset) => {
        const entries = await db.select().from(rankingEntries).where(where)
          .orderBy(asc(rankingEntries.position), asc(rankingEntries.id))
          .limit(limit).offset(offset)

        const athleteIds = [...new Set(entries.flatMap((e) => [e.athleteId, e.athlete2Id].filter(Boolean) as string[]))]
        const athleteList = athleteIds.length
          ? await db.select(publicAthleteColumns).from(athletes).where(inArray(athletes.id, athleteIds))
          : []
        const athleteMap = new Map(athleteList.map((a) => [a.id, a]))

        return entries.map((e) => ({
          ...e,
          athlete:  athleteMap.get(e.athleteId) ?? null,
          athlete2: e.athlete2Id ? (athleteMap.get(e.athlete2Id) ?? null) : null,
        }))
      },
      async () => (await db.select({ total: count() }).from(rankingEntries).where(where))[0]?.total ?? 0,
    )

    return { ...page, ranking }
  })

  // Público, como a lista de entradas: só posição, nomes e pontos (nada de e-mail ou data de nascimento).
  app.get('/rankings/:rankingId/entries/export.csv', async (request, reply) => {
    const { rankingId } = z.object({ rankingId: z.string().min(1) }).parse(request.params)

    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking not found' })

    const entries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, rankingId))
      .orderBy(asc(rankingEntries.position), asc(rankingEntries.id))
    const athleteIds = [...new Set(entries.flatMap((e) => [e.athleteId, e.athlete2Id].filter(Boolean) as string[]))]
    const athleteList = athleteIds.length
      ? await db.select({ id: athletes.id, name: athletes.name }).from(athletes).where(inArray(athletes.id, athleteIds))
      : []
    const nameById = new Map(athleteList.map((a) => [a.id, a.name]))

    const csv = buildCsv(
      ['Posição', 'Atleta', 'Parceiro(a)', 'Pontos', 'Torneios'],
      entries.map((e) => [
        e.position,
        nameById.get(e.athleteId) ?? '',
        e.athlete2Id ? (nameById.get(e.athlete2Id) ?? '') : '',
        e.totalPoints,
        e.tournamentsCount,
      ]),
    )
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', csvAttachmentHeader(rankingFileBase(ranking.name, ranking.year)))
      .send(csv)
  })

  app.post('/rankings/audit-gender', async (_request, _reply) => {
    const allRankings = await db.select().from(rankings).where(eq(rankings.status, 'active'))
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
