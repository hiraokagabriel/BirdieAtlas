import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { clubs, athletes, athleteAffiliations, rankings, rankingEntries } from '../db/schema.js'
import { eq, and, isNull, inArray, asc, count } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { paginationQuerySchema } from '@birdie-atlas/validators'
import { paginate } from '../domain/pagination.js'
import { getDefaultTenantId } from '../tenant.js'

const urlOrEmpty = z.union([z.string().url(), z.literal(''), z.undefined()])

const createClubSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  logoUrl: urlOrEmpty,
  coverUrl: urlOrEmpty,
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
})

export async function clubsRoutes(app: FastifyInstance) {
  app.get('/clubs', async (request) => {
    const query = paginationQuerySchema.parse(request.query)
    const tenantId = await getDefaultTenantId()
    const where = eq(clubs.tenantId, tenantId)
    return paginate(
      query,
      (limit, offset) => db.select().from(clubs).where(where).orderBy(asc(clubs.name), asc(clubs.id)).limit(limit).offset(offset),
      async () => (await db.select({ total: count() }).from(clubs).where(where))[0]?.total ?? 0,
    )
  })

  // Lookup por slug — usado pelo frontend público
  app.get('/clubs/by-slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug))
    if (!club) return reply.status(404).send({ error: 'Club not found' })
    return club
  })

  app.get('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id))
    if (!club) return reply.status(404).send({ error: 'Club not found' })
    return club
  })

  // Perfil público do clube — não expõe email nem birthDate dos atletas
  app.get('/clubs/:id/profile', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id))
    if (!club) return reply.status(404).send({ error: 'Club not found' })

    // Afiliações ativas do clube
    const currentAffiliations = await db
      .select()
      .from(athleteAffiliations)
      .where(and(eq(athleteAffiliations.clubId, id), isNull(athleteAffiliations.endedAt)))

    if (!currentAffiliations.length) {
      return { club, roster: [], totalPoints: 0, avgPoints: 0, rankAmongClubs: null, totalClubs: 0 }
    }

    const athleteIds = currentAffiliations.map((a) => a.athleteId)

    // Seleciona apenas campos públicos dos atletas (sem email, birthDate)
    const rosterAthletes = await db
      .select({
        id: athletes.id,
        name: athletes.name,
        gender: athletes.gender,
        nationality: athletes.nationality,
        photoUrl: athletes.photoUrl,
        active: athletes.active,
      })
      .from(athletes)
      .where(inArray(athletes.id, athleteIds))

    // Rankings ativos do tenant (status = 'active' — campo correto no schema)
    const tenantRankings = await db
      .select()
      .from(rankings)
      .where(and(eq(rankings.tenantId, club.tenantId), eq(rankings.status, 'active')))

    const rankingIds = tenantRankings.map((r) => r.id)
    const rankingMap = new Map(tenantRankings.map((r) => [r.id, r]))

    // Entradas de ranking onde o atleta aparece como atleta1 OU atleta2
    const entriesAthlete1 = rankingIds.length
      ? await db
          .select()
          .from(rankingEntries)
          .where(and(inArray(rankingEntries.rankingId, rankingIds), inArray(rankingEntries.athleteId, athleteIds)))
      : []

    const entriesAthlete2 = rankingIds.length
      ? await db
          .select()
          .from(rankingEntries)
          .where(and(inArray(rankingEntries.rankingId, rankingIds), inArray(rankingEntries.athlete2Id, athleteIds)))
      : []

    // Acumula pontos por atleta (totalPoints — coluna correta)
    const pointsByAthlete = new Map<string, { total: number; byDiscipline: Record<string, number> }>()

    const accumulateEntry = (athleteId: string, entry: typeof entriesAthlete1[0]) => {
      const ranking = rankingMap.get(entry.rankingId)
      if (!ranking) return
      const current = pointsByAthlete.get(athleteId) ?? { total: 0, byDiscipline: {} }
      current.total += entry.totalPoints
      current.byDiscipline[ranking.discipline] =
        (current.byDiscipline[ranking.discipline] ?? 0) + entry.totalPoints
      pointsByAthlete.set(athleteId, current)
    }

    for (const entry of entriesAthlete1) accumulateEntry(entry.athleteId, entry)
    for (const entry of entriesAthlete2) {
      if (entry.athlete2Id) accumulateEntry(entry.athlete2Id, entry)
    }

    const roster = rosterAthletes.map((a) => {
      const pts = pointsByAthlete.get(a.id) ?? { total: 0, byDiscipline: {} }
      return { ...a, totalPoints: pts.total, byDiscipline: pts.byDiscipline }
    }).sort((a, b) => b.totalPoints - a.totalPoints)

    const totalPoints = roster.reduce((s, a) => s + a.totalPoints, 0)
    const avgPoints   = roster.length ? Math.round(totalPoints / roster.length) : 0

    // Ranking de clubes dentro do tenant
    const allAffiliations = await db
      .select()
      .from(athleteAffiliations)
      .where(and(eq(athleteAffiliations.tenantId, club.tenantId), isNull(athleteAffiliations.endedAt)))

    const allAthleteIds = [...new Set(allAffiliations.map((a) => a.athleteId))]

    const allEntries1 = rankingIds.length && allAthleteIds.length
      ? await db.select().from(rankingEntries)
          .where(and(inArray(rankingEntries.rankingId, rankingIds), inArray(rankingEntries.athleteId, allAthleteIds)))
      : []
    const allEntries2 = rankingIds.length && allAthleteIds.length
      ? await db.select().from(rankingEntries)
          .where(and(inArray(rankingEntries.rankingId, rankingIds), inArray(rankingEntries.athlete2Id, allAthleteIds)))
      : []

    const globalPointsByAthlete = new Map<string, number>()
    for (const e of allEntries1) globalPointsByAthlete.set(e.athleteId, (globalPointsByAthlete.get(e.athleteId) ?? 0) + e.totalPoints)
    for (const e of allEntries2) if (e.athlete2Id) globalPointsByAthlete.set(e.athlete2Id, (globalPointsByAthlete.get(e.athlete2Id) ?? 0) + e.totalPoints)

    const clubTotals = new Map<string, number>()
    for (const aff of allAffiliations) {
      const pts = globalPointsByAthlete.get(aff.athleteId) ?? 0
      clubTotals.set(aff.clubId, (clubTotals.get(aff.clubId) ?? 0) + pts)
    }

    const sortedClubs    = [...clubTotals.entries()].sort((a, b) => b[1] - a[1])
    const rankIndex      = sortedClubs.findIndex(([cId]) => cId === id)
    const rankAmongClubs = rankIndex >= 0 ? rankIndex + 1 : null

    return { club, roster, totalPoints, avgPoints, rankAmongClubs, totalClubs: sortedClubs.length }
  })

  app.post('/clubs', async (request, reply) => {
    const body = createClubSchema.parse(request.body)
    const tenantId = await getDefaultTenantId()
    const [club] = await db.insert(clubs).values({ id: randomUUID(), tenantId, ...body }).returning()
    return reply.status(201).send(club)
  })

  app.put('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const updateSchema = createClubSchema.partial()
    const body = updateSchema.parse(request.body)
    const payload = {
      ...body,
      logoUrl:  body.logoUrl  === '' ? null : body.logoUrl,
      coverUrl: body.coverUrl === '' ? null : body.coverUrl,
      updatedAt: new Date(),
    }
    const [club] = await db.update(clubs).set(payload).where(eq(clubs.id, id)).returning()
    if (!club) return reply.status(404).send({ error: 'Club not found' })
    return club
  })

  app.delete('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.delete(clubs).where(eq(clubs.id, id))
    return reply.status(204).send()
  })
}
