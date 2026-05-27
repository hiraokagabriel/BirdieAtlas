import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { athletes, athleteAffiliations, clubs, rankingEntries, rankings, tournamentRegistrations, tournamentCategories, tournaments } from '../db/schema'
import { eq, isNull, and, ilike, or } from 'drizzle-orm'
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

export async function athletesRoutes(app: FastifyInstance) {
  // Lista atletas com clube atual embutido (para tabela do admin)
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

  // Perfil completo público do atleta
  app.get('/athletes/:id/profile', async (request, reply) => {
    const { id } = request.params as { id: string }

    const [athlete] = await db.select().from(athletes).where(eq(athletes.id, id))
    if (!athlete) return reply.status(404).send({ error: 'Athlete not found' })

    // Clube atual
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

    // Posições em rankings (simples e duplas onde o atleta aparece)
    const { inArray } = await import('drizzle-orm')
    const entriesAsAthlete1 = await db.select().from(rankingEntries).where(eq(rankingEntries.athleteId, id))
    const entriesAsAthlete2 = await db.select().from(rankingEntries).where(eq(rankingEntries.athlete2Id, id))
    const allEntries = [...entriesAsAthlete1, ...entriesAsAthlete2]

    const rankingIds = [...new Set(allEntries.map((e) => e.rankingId))]
    const rankingList = rankingIds.length
      ? await db.select().from(rankings).where(inArray(rankings.id, rankingIds))
      : []
    const rankingMap = new Map(rankingList.map((r) => [r.id, r]))

    const rankingPositions = allEntries.map((e) => ({
      rankingId: e.rankingId,
      rankingName: rankingMap.get(e.rankingId)?.name ?? '',
      discipline: rankingMap.get(e.rankingId)?.discipline ?? '',
      year: rankingMap.get(e.rankingId)?.year ?? 0,
      position: e.position,
      points: e.points,
      partnerId: e.athleteId === id ? (e.athlete2Id ?? null) : e.athleteId,
    }))

    // IDs dos parceiros para buscar nomes
    const partnerIds = [...new Set(rankingPositions.map((r) => r.partnerId).filter(Boolean) as string[])]
    const partnerList = partnerIds.length
      ? await db.select({ id: athletes.id, name: athletes.name }).from(athletes).where(inArray(athletes.id, partnerIds))
      : []
    const partnerMap = new Map(partnerList.map((p) => [p.id, p.name]))

    const rankingPositionsEnriched = rankingPositions.map((r) => ({
      ...r,
      partnerName: r.partnerId ? (partnerMap.get(r.partnerId) ?? null) : null,
    }))

    // Histórico de torneios (via inscrições confirmadas)
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
        rankingPointsAtEntry: reg.rankingPointsAtEntry,
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

  // Histórico completo de afiliações com dados do clube
  app.get('/athletes/:id/affiliations', async (request) => {
    const { id } = request.params as { id: string }
    return db
      .select({
        id: athleteAffiliations.id,
        clubId: clubs.id,
        clubName: clubs.name,
        clubSlug: clubs.slug,
        city: clubs.city,
        state: clubs.state,
        startedAt: athleteAffiliations.startedAt,
        endedAt: athleteAffiliations.endedAt,
      })
      .from(athleteAffiliations)
      .leftJoin(clubs, eq(clubs.id, athleteAffiliations.clubId))
      .where(eq(athleteAffiliations.athleteId, id))
  })

  app.post('/athletes', async (request, reply) => {
    const body = createAthleteSchema.parse(request.body)
    const [athlete] = await db.insert(athletes).values({ id: randomUUID(), ...body }).returning()
    return reply.status(201).send(athlete)
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
