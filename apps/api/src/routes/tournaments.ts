import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { tournaments, tournamentCategories, tournamentRegistrations, athletes } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const createTournamentSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  level: z.string().default('estadual'),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pointsTableId: z.string().optional(),
  rankingId: z.string().optional(),
})

const createCategorySchema = z.object({
  discipline: z.enum(['MS', 'WS', 'MD', 'WD', 'XD']),
  name: z.string().min(1),
  drawType: z.enum(['single_elimination', 'round_robin', 'group_then_elimination']).default('single_elimination'),
  maxEntries: z.number().optional(),
  seedCount: z.number().default(4),
})

const createRegistrationSchema = z.object({
  athleteId: z.string(),
  athlete2Id: z.string().optional(),
  seed: z.number().optional(),
  rankingPointsAtEntry: z.number().optional(),
})

async function validateGender(
  discipline: string,
  athleteId: string,
  athlete2Id: string | undefined,
): Promise<{ error: string } | null> {
  const ids = [athleteId, athlete2Id].filter(Boolean) as string[]
  const athleteRows = await Promise.all(ids.map((id) => db.select().from(athletes).where(eq(athletes.id, id)).limit(1)))
  const [a1Row, a2Row] = athleteRows.map((r) => r[0])

  if (!a1Row) return { error: 'Athlete not found' }

  if (discipline === 'MS' || discipline === 'MD') {
    if (a1Row.gender !== 'M') return { error: `Gender violation for discipline ${discipline}: athlete must be male` }
    if (a2Row && a2Row.gender !== 'M') return { error: `Gender violation for discipline ${discipline}: athlete2 must be male` }
  }

  if (discipline === 'WS' || discipline === 'WD') {
    if (a1Row.gender !== 'F') return { error: `Gender violation for discipline ${discipline}: athlete must be female` }
    if (a2Row && a2Row.gender !== 'F') return { error: `Gender violation for discipline ${discipline}: athlete2 must be female` }
  }

  if (discipline === 'XD') {
    if (!a2Row) return { error: 'Gender violation for discipline XD: XD requires two athletes' }
    const genders = new Set([a1Row.gender, a2Row.gender])
    if (!genders.has('M') || !genders.has('F')) {
      return { error: 'Gender violation for discipline XD: XD requires one male and one female athlete' }
    }
  }

  return null
}

export async function tournamentsRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------------------
  // Tournaments
  // ---------------------------------------------------------------------------

  app.get('/tournaments', async (request) => {
    const { tenantId } = request.query as { tenantId?: string }
    if (tenantId) {
      return db.select().from(tournaments).where(eq(tournaments.tenantId, tenantId))
    }
    return db.select().from(tournaments)
  })

  // Rota dedicada por slug — usada pela p\u00e1gina p\u00fablica e pelo dashboard
  // Precisa vir ANTES de /tournaments/:id para n\u00e3o conflitar
  app.get('/tournaments/by-slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.slug, slug)).limit(1)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    return tournament
  })

  app.get('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    return tournament
  })

  app.post('/tournaments', async (request, reply) => {
    const body = createTournamentSchema.parse(request.body)
    const [tournament] = await db
      .insert(tournaments)
      .values({ id: randomUUID(), ...body })
      .returning()
    return reply.status(201).send(tournament)
  })

  app.put('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createTournamentSchema.partial().parse(request.body)
    const [tournament] = await db
      .update(tournaments)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tournaments.id, id))
      .returning()
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    return tournament
  })

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  app.get('/tournaments/:id/categories', async (request) => {
    const { id } = request.params as { id: string }
    return db.select().from(tournamentCategories).where(eq(tournamentCategories.tournamentId, id))
  })

  app.post('/tournaments/:id/categories', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createCategorySchema.parse(request.body)
    const [category] = await db
      .insert(tournamentCategories)
      .values({ id: randomUUID(), tournamentId: id, ...body })
      .returning()
    return reply.status(201).send(category)
  })

  // ---------------------------------------------------------------------------
  // Registrations
  // ---------------------------------------------------------------------------

  // Retorna inscri\u00e7\u00f5es com dados dos atletas j\u00e1 embutidos (evita N+1 no front)
  app.get('/tournaments/categories/:categoryId/registrations', async (request) => {
    const { categoryId } = request.params as { categoryId: string }

    const a1 = { id: athletes.id, name: athletes.name, gender: athletes.gender }

    const rows = await db
      .select({
        id: tournamentRegistrations.id,
        categoryId: tournamentRegistrations.categoryId,
        athleteId: tournamentRegistrations.athleteId,
        athlete2Id: tournamentRegistrations.athlete2Id,
        seed: tournamentRegistrations.seed,
        confirmed: tournamentRegistrations.confirmed,
        withdrew: tournamentRegistrations.withdrew,
        rankingPointsAtEntry: tournamentRegistrations.rankingPointsAtEntry,
        createdAt: tournamentRegistrations.createdAt,
        athleteName: athletes.name,
        athleteGender: athletes.gender,
      })
      .from(tournamentRegistrations)
      .leftJoin(athletes, eq(tournamentRegistrations.athleteId, athletes.id))
      .where(
        and(
          eq(tournamentRegistrations.categoryId, categoryId),
          eq(tournamentRegistrations.withdrew, false),
        )
      )

    // Para duplas, buscar nome do segundo atleta separadamente
    const withPartner = await Promise.all(
      rows.map(async (row) => {
        if (!row.athlete2Id) return { ...row, athlete2Name: null }
        const [a2] = await db.select({ name: athletes.name }).from(athletes).where(eq(athletes.id, row.athlete2Id)).limit(1)
        return { ...row, athlete2Name: a2?.name ?? null }
      })
    )

    return withPartner
  })

  app.post('/tournaments/categories/:categoryId/registrations', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const body = createRegistrationSchema.parse(request.body)

    const [category] = await db.select().from(tournamentCategories).where(eq(tournamentCategories.id, categoryId))
    if (!category) return reply.status(404).send({ error: 'Category not found' })

    const genderViolation = await validateGender(category.discipline, body.athleteId, body.athlete2Id)
    if (genderViolation) return reply.status(422).send(genderViolation)

    const [registration] = await db
      .insert(tournamentRegistrations)
      .values({ id: randomUUID(), categoryId, ...body })
      .returning()
    return reply.status(201).send(registration)
  })

  // Soft-delete: marca withdrew = true em vez de deletar
  app.delete('/tournaments/registrations/:registrationId', async (request, reply) => {
    const { registrationId } = request.params as { registrationId: string }
    const [reg] = await db
      .update(tournamentRegistrations)
      .set({ withdrew: true, updatedAt: new Date() })
      .where(eq(tournamentRegistrations.id, registrationId))
      .returning()
    if (!reg) return reply.status(404).send({ error: 'Registration not found' })
    return { ok: true }
  })
}
