import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { pairs, athletes, athleteAffiliations, clubs } from '../db/schema'
import { eq, and, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const DOUBLES_DISCIPLINES = ['MD', 'WD', 'XD'] as const

const createPairSchema = z.object({
  tenantId: z.string().min(1),
  athlete1Id: z.string().min(1),
  athlete2Id: z.string().min(1),
  discipline: z.enum(DOUBLES_DISCIPLINES),
  active: z.boolean().optional().default(true),
})

const updatePairSchema = z.object({
  discipline: z.enum(DOUBLES_DISCIPLINES).optional(),
  active: z.boolean().optional(),
})

// Busca o clube atual de um atleta (afiliação ativa mais recente)
async function getCurrentClub(athleteId: string) {
  const [aff] = await db
    .select({ clubId: athleteAffiliations.clubId })
    .from(athleteAffiliations)
    .where(and(eq(athleteAffiliations.athleteId, athleteId), isNull(athleteAffiliations.endedAt)))
    .limit(1)
  if (!aff) return null
  const [club] = await db
    .select({ id: clubs.id, name: clubs.name, logoUrl: clubs.logoUrl, primaryColor: clubs.primaryColor })
    .from(clubs)
    .where(eq(clubs.id, aff.clubId))
  return club ?? null
}

export async function pairsRoutes(app: FastifyInstance) {
  // Lista todas as duplas com dados expandidos dos atletas e seus clubes
  app.get('/pairs', async (request) => {
    const { tenantId, active, discipline } = request.query as {
      tenantId?: string
      active?: string
      discipline?: string
    }

    let query = db.select().from(pairs)

    const conditions = []
    if (tenantId) conditions.push(eq(pairs.tenantId, tenantId))
    if (active !== undefined) conditions.push(eq(pairs.active, active === 'true'))

    const rawPairs = conditions.length
      ? await db.select().from(pairs).where(and(...conditions))
      : await db.select().from(pairs)

    // Filtra por disciplina após a query (enum já valida no banco)
    const filtered = discipline
      ? rawPairs.filter((p) => p.discipline === discipline)
      : rawPairs

    // Expande atletas e clubes em paralelo
    const expanded = await Promise.all(
      filtered.map(async (pair) => {
        const [athlete1, athlete2] = await Promise.all([
          db.select({
            id: athletes.id,
            name: athletes.name,
            gender: athletes.gender,
            photoUrl: athletes.photoUrl,
            active: athletes.active,
          }).from(athletes).where(eq(athletes.id, pair.athlete1Id)).limit(1),
          db.select({
            id: athletes.id,
            name: athletes.name,
            gender: athletes.gender,
            photoUrl: athletes.photoUrl,
            active: athletes.active,
          }).from(athletes).where(eq(athletes.id, pair.athlete2Id)).limit(1),
        ])

        const [club1, club2] = await Promise.all([
          getCurrentClub(pair.athlete1Id),
          getCurrentClub(pair.athlete2Id),
        ])

        return {
          ...pair,
          athlete1: athlete1[0] ? { ...athlete1[0], club: club1 } : null,
          athlete2: athlete2[0] ? { ...athlete2[0], club: club2 } : null,
        }
      })
    )

    return { data: expanded, total: expanded.length }
  })

  // Busca dupla por ID
  app.get('/pairs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [pair] = await db.select().from(pairs).where(eq(pairs.id, id))
    if (!pair) return reply.status(404).send({ error: 'Pair not found' })

    const [athlete1Raw, athlete2Raw] = await Promise.all([
      db.select({ id: athletes.id, name: athletes.name, gender: athletes.gender, photoUrl: athletes.photoUrl, active: athletes.active })
        .from(athletes).where(eq(athletes.id, pair.athlete1Id)).limit(1),
      db.select({ id: athletes.id, name: athletes.name, gender: athletes.gender, photoUrl: athletes.photoUrl, active: athletes.active })
        .from(athletes).where(eq(athletes.id, pair.athlete2Id)).limit(1),
    ])

    const [club1, club2] = await Promise.all([
      getCurrentClub(pair.athlete1Id),
      getCurrentClub(pair.athlete2Id),
    ])

    return {
      ...pair,
      athlete1: athlete1Raw[0] ? { ...athlete1Raw[0], club: club1 } : null,
      athlete2: athlete2Raw[0] ? { ...athlete2Raw[0], club: club2 } : null,
    }
  })

  // Cria nova dupla
  app.post('/pairs', async (request, reply) => {
    const body = createPairSchema.parse(request.body)

    if (body.athlete1Id === body.athlete2Id) {
      return reply.status(400).send({ error: 'Os dois atletas devem ser diferentes.' })
    }

    // Verifica duplicata ativa (mesma dupla na mesma disciplina)
    const existing = await db.select().from(pairs).where(
      and(
        eq(pairs.tenantId, body.tenantId),
        eq(pairs.discipline, body.discipline),
        eq(pairs.active, true),
        or(
          and(eq(pairs.athlete1Id, body.athlete1Id), eq(pairs.athlete2Id, body.athlete2Id)),
          and(eq(pairs.athlete1Id, body.athlete2Id), eq(pairs.athlete2Id, body.athlete1Id)),
        ),
      )
    )

    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Essa dupla já está ativa nesta disciplina.' })
    }

    const [pair] = await db.insert(pairs).values({
      id: randomUUID(),
      tenantId: body.tenantId,
      athlete1Id: body.athlete1Id,
      athlete2Id: body.athlete2Id,
      discipline: body.discipline,
      active: body.active,
    }).returning()

    return reply.status(201).send(pair)
  })

  // Edita disciplina e/ou status
  app.put('/pairs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updatePairSchema.parse(request.body)

    const [pair] = await db
      .update(pairs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(pairs.id, id))
      .returning()

    if (!pair) return reply.status(404).send({ error: 'Pair not found' })
    return pair
  })

  // Soft delete — desativa a dupla
  app.delete('/pairs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [pair] = await db
      .update(pairs)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(pairs.id, id))
      .returning()

    if (!pair) return reply.status(404).send({ error: 'Pair not found' })
    return reply.status(204).send()
  })
}
