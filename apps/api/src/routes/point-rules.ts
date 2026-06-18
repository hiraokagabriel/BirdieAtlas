import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { pointRules, rankings } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const entrySchema = z.object({
  placement: z.number().int().min(1),
  basePoints: z.number().min(0),
})

const createPointRuleSchema = z.object({
  // Nível do torneio ao qual a regra se aplica
  tournamentLevel: z.enum(['local', 'regional', 'state', 'national', 'international']),
  // Opcional: null = aplica a todas as disciplinas do ranking
  discipline: z.enum(['MS', 'WS', 'MD', 'WD', 'XD']).nullable().optional(),
  // Opcional: null = aplica a todas as categorias (Open, Sub-19, etc.)
  category: z.string().nullable().optional(),
  // Multiplicador sobre os pontos base. Ex: 1.5 = vale 50% a mais
  multiplier: z.number().min(0).default(1.0),
  // Bônus fixo de participação independente da colocação
  participationBonus: z.number().min(0).default(0),
  // Tabela colocação -> pontos base
  entries: z.array(entrySchema).default([]),
})

const bulkSchema = z.object({
  // Substitui TODAS as regras do ranking pelas enviadas
  rules: z.array(createPointRuleSchema).min(1),
})

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
export async function pointRulesRoutes(app: FastifyInstance) {

  // GET /rankings/:rankingId/point-rules
  // Lista todas as regras ativas de um ranking, ordenadas por nível
  app.get('/rankings/:rankingId/point-rules', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }

    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking não encontrado' })

    const rules = await db.select().from(pointRules)
      .where(and(
        eq(pointRules.rankingId, rankingId),
        isNull(pointRules.deletedAt),
      ))

    return rules
  })

  // POST /rankings/:rankingId/point-rules
  // Cria uma nova regra
  app.post('/rankings/:rankingId/point-rules', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }

    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking não encontrado' })

    const body = createPointRuleSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: body.error.flatten() })
    }

    const [rule] = await db.insert(pointRules).values({
      id: randomUUID(),
      rankingId,
      tournamentLevel: body.data.tournamentLevel,
      discipline: body.data.discipline ?? null,
      category: body.data.category ?? null,
      multiplier: body.data.multiplier,
      participationBonus: body.data.participationBonus,
      entries: body.data.entries,
    }).returning()

    return reply.status(201).send(rule)
  })

  // PUT /rankings/:rankingId/point-rules/:ruleId
  // Atualiza uma regra existente
  app.put('/rankings/:rankingId/point-rules/:ruleId', async (request, reply) => {
    const { rankingId, ruleId } = request.params as { rankingId: string; ruleId: string }

    const [existing] = await db.select().from(pointRules)
      .where(and(eq(pointRules.id, ruleId), eq(pointRules.rankingId, rankingId), isNull(pointRules.deletedAt)))
    if (!existing) return reply.status(404).send({ error: 'Regra não encontrada' })

    const body = createPointRuleSchema.partial().safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: body.error.flatten() })
    }

    const [updated] = await db.update(pointRules)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(pointRules.id, ruleId))
      .returning()

    return updated
  })

  // DELETE /rankings/:rankingId/point-rules/:ruleId
  // Soft-delete: marca deletedAt, não remove fisicamente
  app.delete('/rankings/:rankingId/point-rules/:ruleId', async (request, reply) => {
    const { rankingId, ruleId } = request.params as { rankingId: string; ruleId: string }

    const [existing] = await db.select().from(pointRules)
      .where(and(eq(pointRules.id, ruleId), eq(pointRules.rankingId, rankingId), isNull(pointRules.deletedAt)))
    if (!existing) return reply.status(404).send({ error: 'Regra não encontrada' })

    await db.update(pointRules)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(pointRules.id, ruleId))

    return reply.status(204).send()
  })

  // POST /rankings/:rankingId/point-rules/bulk
  // Substitui TODAS as regras do ranking pelas enviadas (atomic replace)
  // Útil para salvar o estado completo do editor de uma vez só
  app.post('/rankings/:rankingId/point-rules/bulk', async (request, reply) => {
    const { rankingId } = request.params as { rankingId: string }

    const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
    if (!ranking) return reply.status(404).send({ error: 'Ranking não encontrado' })

    const body = bulkSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: body.error.flatten() })
    }

    // Soft-delete todas as regras atuais
    await db.update(pointRules)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pointRules.rankingId, rankingId), isNull(pointRules.deletedAt)))

    // Insere as novas
    const inserted = await db.insert(pointRules).values(
      body.data.rules.map((r) => ({
        id: randomUUID(),
        rankingId,
        tournamentLevel: r.tournamentLevel,
        discipline: r.discipline ?? null,
        category: r.category ?? null,
        multiplier: r.multiplier,
        participationBonus: r.participationBonus,
        entries: r.entries,
      }))
    ).returning()

    return reply.status(201).send({ created: inserted.length, rules: inserted })
  })
}
