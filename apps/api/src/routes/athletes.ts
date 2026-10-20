import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { athletes, athleteAffiliations, clubs, pairs, rankingEntries, rankings, tournamentRegistrations, tournamentCategories, tournaments } from '../db/schema.js'
import { eq, isNull, and, ilike, or, inArray, asc, count } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { paginationQuerySchema } from '@birdie-atlas/validators'
import { selectRegistrations } from '../db/registrations.js'
import { paginate } from '../domain/pagination.js'
import { getDefaultTenantId } from '../tenant.js'

const createAthleteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  gender: z.enum(['M', 'F']),
  birthDate: z.string().optional(),
  nationality: z.string().default('BR'),
  photoUrl: z.string().url().optional(),
})

// Schema para cada linha do CSV já parseada em objeto
const csvRowSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  gender: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Gênero deve ser M ou F' }) }),
  birthDate: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  nationality: z.string().default('BR'),
})

const listAthletesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  gender: z.enum(['M', 'F']).optional(),
})

export async function athletesRoutes(app: FastifyInstance) {
  // Admin: lista paginada com clube atual no tenant padrão. Inclui e-mail e data de nascimento.
  app.get('/athletes', async (request) => {
    const query = listAthletesQuerySchema.parse(request.query)
    const tenantId = await getDefaultTenantId()
    const where = and(
      isNull(athletes.deletedAt),
      query.search
        ? or(ilike(athletes.name, `%${query.search}%`), ilike(athletes.email, `%${query.search}%`))
        : undefined,
      query.gender ? eq(athletes.gender, query.gender) : undefined,
    )

    return paginate(
      query,
      (limit, offset) =>
        db
          .select({
            id: athletes.id,
            name: athletes.name,
            email: athletes.email,
            gender: athletes.gender,
            birthDate: athletes.birthDate,
            nationality: athletes.nationality,
            photoUrl: athletes.photoUrl,
            active: athletes.active,
            createdAt: athletes.createdAt,
            clubId: clubs.id,
            clubName: clubs.name,
            clubSlug: clubs.slug,
            affiliationStart: athleteAffiliations.startedAt,
          })
          .from(athletes)
          .leftJoin(
            athleteAffiliations,
            and(
              eq(athleteAffiliations.athleteId, athletes.id),
              eq(athleteAffiliations.tenantId, tenantId),
              isNull(athleteAffiliations.endedAt),
            ),
          )
          .leftJoin(clubs, eq(clubs.id, athleteAffiliations.clubId))
          .where(where)
          .orderBy(asc(athletes.name), asc(athletes.id))
          .limit(limit)
          .offset(offset),
      async () => {
        const [row] = await db.select({ total: count() }).from(athletes).where(where)
        return row?.total ?? 0
      },
    )
  })

  app.get('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [athlete] = await db.select().from(athletes).where(and(eq(athletes.id, id), isNull(athletes.deletedAt)))
    if (!athlete) return reply.status(404).send({ error: 'Athlete not found' })
    return athlete
  })

  // Rota pública — não expõe dados sensíveis (email, birthDate)
  app.get('/athletes/:id/profile', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Seleciona apenas campos seguros para exposição pública
    const [athlete] = await db
      .select({
        id: athletes.id,
        name: athletes.name,
        gender: athletes.gender,
        nationality: athletes.nationality,
        photoUrl: athletes.photoUrl,
        active: athletes.active,
      })
      .from(athletes)
      .where(and(eq(athletes.id, id), isNull(athletes.deletedAt)))

    if (!athlete) return reply.status(404).send({ error: 'Athlete not found' })

    const [currentAffiliation] = await db
      .select({
        clubId: clubs.id,
        clubName: clubs.name,
        clubSlug: clubs.slug,
        city: clubs.city,
        state: clubs.state,
        startedAt: athleteAffiliations.startedAt,
      })
      .from(athleteAffiliations)
      .leftJoin(clubs, eq(clubs.id, athleteAffiliations.clubId))
      .where(and(eq(athleteAffiliations.athleteId, id), isNull(athleteAffiliations.endedAt)))
      .limit(1)

    // Busca entradas de ranking onde o atleta aparece (simples ou dupla)
    const entriesAsAthlete1 = await db
      .select({
        rankingId: rankingEntries.rankingId,
        position: rankingEntries.position,
        totalPoints: rankingEntries.totalPoints,
        athleteId: rankingEntries.athleteId,
        athlete2Id: rankingEntries.athlete2Id,
      })
      .from(rankingEntries)
      .where(eq(rankingEntries.athleteId, id))

    const entriesAsAthlete2 = await db
      .select({
        rankingId: rankingEntries.rankingId,
        position: rankingEntries.position,
        totalPoints: rankingEntries.totalPoints,
        athleteId: rankingEntries.athleteId,
        athlete2Id: rankingEntries.athlete2Id,
      })
      .from(rankingEntries)
      .where(eq(rankingEntries.athlete2Id, id))

    const allEntries = [...entriesAsAthlete1, ...entriesAsAthlete2]

    const rankingIds = [...new Set(allEntries.map((e) => e.rankingId))]
    const rankingList = rankingIds.length
      ? await db
          .select({ id: rankings.id, name: rankings.name, discipline: rankings.discipline, year: rankings.year })
          .from(rankings)
          .where(inArray(rankings.id, rankingIds))
      : []
    const rankingMap = new Map(rankingList.map((r) => [r.id, r]))

    const rankingPositions = allEntries.map((e) => ({
      rankingId: e.rankingId,
      rankingName: rankingMap.get(e.rankingId)?.name ?? '',
      discipline: rankingMap.get(e.rankingId)?.discipline ?? '',
      year: rankingMap.get(e.rankingId)?.year ?? 0,
      position: e.position,
      totalPoints: e.totalPoints,
      partnerId: e.athleteId === id ? (e.athlete2Id ?? null) : e.athleteId,
    }))

    const partnerIds = [...new Set(rankingPositions.map((r) => r.partnerId).filter(Boolean) as string[])]
    const partnerList = partnerIds.length
      ? await db
          .select({ id: athletes.id, name: athletes.name })
          .from(athletes)
          .where(inArray(athletes.id, partnerIds))
      : []
    const partnerMap = new Map(partnerList.map((p) => [p.id, p.name]))

    const rankingPositionsEnriched = rankingPositions.map((r) => ({
      ...r,
      partnerName: r.partnerId ? (partnerMap.get(r.partnerId) ?? null) : null,
    }))

    // Histórico de torneios: inscrições aprovadas, sozinho ou em qualquer dupla (inclusive duplas excluídas)
    const myPairs = await db.select({ id: pairs.id }).from(pairs)
      .where(or(eq(pairs.athlete1Id, id), eq(pairs.athlete2Id, id)))
    const pairIds = myPairs.map((p) => p.id)
    const allRegs = await selectRegistrations(and(
      eq(tournamentRegistrations.status, 'approved'),
      or(eq(tournamentRegistrations.athleteId, id), pairIds.length ? inArray(tournamentRegistrations.pairId, pairIds) : undefined),
    ))

    const categoryIds = [...new Set(allRegs.map((r) => r.categoryId))]
    const categoryList = categoryIds.length
      ? await db.select().from(tournamentCategories).where(inArray(tournamentCategories.id, categoryIds))
      : []
    const categoryMap = new Map(categoryList.map((c) => [c.id, c]))

    const tournamentIds = [...new Set(categoryList.map((c) => c.tournamentId))]
    const tournamentList = tournamentIds.length
      ? await db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds))
      : []
    const tournamentMap = new Map(tournamentList.map((t) => [t.id, t]))

    const tournamentHistory = allRegs.map((reg) => {
      const category = categoryMap.get(reg.categoryId)
      const tournament = category ? tournamentMap.get(category.tournamentId) : null
      return {
        registrationId: reg.id,
        seed: reg.seed,
        finalPlacement: reg.finalPlacement,
        categoryId: reg.categoryId,
        categoryName: category?.name ?? '',
        discipline: category?.discipline ?? '',
        tournamentId: tournament?.id ?? '',
        tournamentName: tournament?.name ?? '',
        tournamentSlug: tournament?.slug ?? '',
        tournamentStatus: tournament?.status ?? '',
        startDate: tournament?.startDate ?? '',
        endDate: tournament?.endDate ?? '',
        level: tournament?.level ?? '',
        city: tournament?.city ?? '',
        state: tournament?.state ?? '',
      }
    }).sort((a, b) => b.startDate.localeCompare(a.startDate))

    return {
      athlete,
      currentClub: currentAffiliation ?? null,
      rankingPositions: rankingPositionsEnriched,
      tournamentHistory,
    }
  })

  // NOTA: GET /athletes/:id/affiliations foi removido daqui.
  // A rota vive em affiliations.ts com payload mais completo.

  app.post('/athletes', async (request, reply) => {
    const body = createAthleteSchema.parse(request.body)
    const [athlete] = await db.insert(athletes).values({ id: randomUUID(), ...body }).returning()
    return reply.status(201).send(athlete)
  })

  app.post('/athletes/import-csv', async (request, reply) => {
    const body = request.body as unknown[]
    if (!Array.isArray(body)) {
      return reply.status(400).send({ error: 'Body deve ser um array de objetos' })
    }

    const created: string[] = []
    const errors: { row: number; reason: string }[] = []

    for (let i = 0; i < body.length; i++) {
      const parsed = csvRowSchema.safeParse(body[i])
      if (!parsed.success) {
        const reason = parsed.error.errors.map((e) => e.message).join(', ')
        errors.push({ row: i + 1, reason })
        continue
      }
      try {
        const [athlete] = await db
          .insert(athletes)
          .values({ id: randomUUID(), ...parsed.data })
          .returning()
        created.push(athlete.name)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        errors.push({ row: i + 1, reason: msg })
      }
    }

    return reply.status(200).send({
      total: body.length,
      created: created.length,
      failed: errors.length,
      createdNames: created,
      errors,
    })
  })

  app.put('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createAthleteSchema.partial().parse(request.body)
    const [athlete] = await db.update(athletes).set({ ...body, updatedAt: new Date() }).where(and(eq(athletes.id, id), isNull(athletes.deletedAt))).returning()
    if (!athlete) return reply.status(404).send({ error: 'Athlete not found' })
    return athlete
  })

  app.delete('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.update(athletes).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(athletes.id, id), isNull(athletes.deletedAt)))
    return reply.status(204).send()
  })
}
