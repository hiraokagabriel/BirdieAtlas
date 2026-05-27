import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { athletes, athleteAffiliations, clubs } from '../db/schema'
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
          ? or(
              ilike(athletes.name, `%${search}%`),
              ilike(athletes.email ?? '', `%${search}%`)
            )
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
        .where(
          tenantId
            ? eq(athleteAffiliations.tenantId, tenantId)
            : eq(athleteAffiliations.clubId, clubId!)
        )
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
    const [athlete] = await db
      .insert(athletes)
      .values({ id: randomUUID(), ...body })
      .returning()
    return reply.status(201).send(athlete)
  })

  app.post('/athletes/:id/affiliate', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = affiliateSchema.parse(request.body)
    await db
      .update(athleteAffiliations)
      .set({ endedAt: body.startedAt, updatedAt: new Date() })
      .where(eq(athleteAffiliations.athleteId, id))
    const [affiliation] = await db
      .insert(athleteAffiliations)
      .values({ id: randomUUID(), athleteId: id, ...body })
      .returning()
    return reply.status(201).send(affiliation)
  })

  app.put('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createAthleteSchema.partial().parse(request.body)
    const [athlete] = await db
      .update(athletes)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(athletes.id, id))
      .returning()
    if (!athlete) return reply.status(404).send({ error: 'Athlete not found' })
    return athlete
  })

  app.delete('/athletes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.update(athletes).set({ active: false, updatedAt: new Date() }).where(eq(athletes.id, id))
    return reply.status(204).send()
  })
}
