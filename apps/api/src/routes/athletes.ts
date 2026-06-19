import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { athletes, athleteAffiliations, clubs, rankingEntries, rankings, tournamentRegistrations, tournamentCategories, tournaments } from '../db/schema'
import { eq, isNull, and, ilike, or, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const createAthleteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  gender: z.enum(['M', 'F']),
  birthDate: z.string().optional(),
  nationality: z.string().default('BR'),
  photoUrl: z.string().url().optional(),
})

const affiliateSchema = z.object({
  clubId: z.string(),
  tenantId: z.string(),
  startedAt: z.string(),
})

// Schema para cada linha do CSV já parseada em objeto
const csvRowSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  gender: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Gênero deve ser M ou F' }) }),
  birthDate: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  nationality: z.string().default('BR'),
})

export async function athletesRoutes(app: FastifyInstance) {
  app.get('/athletes/with-club', async (request) => {
    const { tenantId, search } = request.query as { tenantId?: string; search?: string }
    const rows = await db
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
          isNull(athleteAffiliations.endedAt),
          tenantId ? eq(athleteAffiliations.tenantId, tenantId) : undefined
        )
      )
      .leftJoin(clubs, eq(clubs.id, athleteAffiliations.clubId))
      .where(
        search
          ? or(ilike(athletes.name, `%${search}%`), ilike(athletes.email ?? '', `%${search}%`))
          : undefined
      )
    return rows
  })

  app.get('/athletes', async (request) => {
    const { tenantId, clubId } = request.query as { tenantId?: string; clubId?: string }
    if (tenantId || clubId) {
      const rows = await db
        .select()
        .from(athletes)
        .innerJoin(athleteAffiliations, eq(athletes.id, athleteAffiliations.athleteId))
        .where(tenantId ? eq(athleteAffiliations.tenantId, tenantId) : eq(athleteAffiliations.clubId, clubId!))
      return rows
    }
    return db.select().from(athletes)
  })

  app.get('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [athlete] = await db.select().from(athletes).where(eq(athletes.id, id))
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
      .where(eq(athletes.id, id))

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

    // Histórico de torneios confirmados
    const regs1 = await db
      .select()
      .from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.athleteId, id), eq(tournamentRegistrations.confirmed, true)))
    const regs2 = await db
      .select()
      .from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.athlete2Id, id), eq(tournamentRegistrations.confirmed, true)))
    const allRegs = [...regs1, ...regs2]

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
        withdrew: reg.withdrew,
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

  app.post('/athletes/:id/affiliate', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = affiliateSchema.parse(request.body)
    await db.update(athleteAffiliations).set({ endedAt: body.startedAt, updatedAt: new Date() }).where(eq(athleteAffiliations.athleteId, id))
    const [affiliation] = await db.insert(athleteAffiliations).values({ id: randomUUID(), athleteId: id, ...body }).returning()
    return reply.status(201).send(affiliation)
  })

  app.put('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createAthleteSchema.partial().parse(request.body)
    const [athlete] = await db.update(athletes).set({ ...body, updatedAt: new Date() }).where(eq(athletes.id, id)).returning()
    if (!athlete) return reply.status(404).send({ error: 'Athlete not found' })
    return athlete
  })

  app.delete('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.update(athletes).set({ active: false, updatedAt: new Date() }).where(eq(athletes.id, id))
    return reply.status(204).send()
  })
}
