import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { pairs, athletes, athleteAffiliations, clubs } from '../db/schema.js'
import { eq, and, isNull, or, asc, desc, count } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { paginationQuerySchema } from '@birdie-atlas/validators'
import { paginate } from '../domain/pagination.js'
import { getDefaultTenantId } from '../tenant.js'

const DOUBLES_DISCIPLINES = ['MD', 'WD', 'XD'] as const

const listPairsQuerySchema = paginationQuerySchema.extend({
  active: z.enum(['true', 'false']).optional(),
  discipline: z.enum(DOUBLES_DISCIPLINES).optional(),
})

const createPairSchema = z.object({
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
    const query = listPairsQuerySchema.parse(request.query)
    const tenantId = await getDefaultTenantId()
    const where = and(
      eq(pairs.tenantId, tenantId),
      isNull(pairs.deletedAt),
      query.active !== undefined ? eq(pairs.active, query.active === 'true') : undefined,
      query.discipline ? eq(pairs.discipline, query.discipline) : undefined,
    )

    return paginate(
      query,
      async (limit, offset) => {
        const page = await db.select().from(pairs).where(where)
          .orderBy(desc(pairs.createdAt), asc(pairs.id)).limit(limit).offset(offset)
        return expandPairs(page)
      },
      async () => (await db.select({ total: count() }).from(pairs).where(where))[0]?.total ?? 0,
    )
  })

  // Expande atletas (só campos públicos) e clubes em paralelo
  async function expandPairs(rawPairs: (typeof pairs.$inferSelect)[]) {
    return Promise.all(
      rawPairs.map(async (pair) => {
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
  }

  // Busca dupla por ID
  app.get('/pairs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [pair] = await db.select().from(pairs).where(and(eq(pairs.id, id), isNull(pairs.deletedAt)))
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
    const tenantId = await getDefaultTenantId()

    if (body.athlete1Id === body.athlete2Id) {
      return reply.status(400).send({ error: 'Os dois atletas devem ser diferentes.' })
    }

    // Verifica duplicata ativa (mesma dupla na mesma disciplina)
    const existing = await db.select().from(pairs).where(
      and(
        eq(pairs.tenantId, tenantId),
        eq(pairs.discipline, body.discipline),
        eq(pairs.active, true),
        isNull(pairs.deletedAt),
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
      tenantId,
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
      .where(and(eq(pairs.id, id), isNull(pairs.deletedAt)))
      .returning()

    if (!pair) return reply.status(404).send({ error: 'Pair not found' })
    return pair
  })

  // Soft delete: some das listas, mas o histórico (inscrições, rankings) continua íntegro.
  // Para só desativar, use PUT { active: false }.
  app.delete('/pairs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [pair] = await db
      .update(pairs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pairs.id, id), isNull(pairs.deletedAt)))
      .returning()

    if (!pair) return reply.status(404).send({ error: 'Pair not found' })
    return reply.status(204).send()
  })
}
