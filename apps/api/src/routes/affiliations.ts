import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { athleteAffiliations, clubs, athletes } from '../db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const createSchema = z.object({
  athleteId: z.string().min(1),
  clubId: z.string().min(1),
  tenantId: z.string().min(1),
  /**
   * Data de início da afiliação — AAAA-MM-DD.
   * Obrigatório. Permite granularidade mensal (basta usar AAAA-MM-01).
   */
  startedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startedAt deve ser AAAA-MM-DD'),
  /**
   * Data de encerramento — opcional, null = afiliação ainda ativa.
   */
  endedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endedAt deve ser AAAA-MM-DD')
    .nullable()
    .optional(),
})

const updateSchema = z.object({
  startedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startedAt deve ser AAAA-MM-DD')
    .optional(),
  endedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endedAt deve ser AAAA-MM-DD')
    .nullable()
    .optional(),
  clubId: z.string().optional(),
})

export async function affiliationsRoutes(app: FastifyInstance) {
  /**
   * GET /athletes/:athleteId/affiliations
   *
   * Lista todo o histórico de afiliações de um atleta,
   * ordenado do mais recente para o mais antigo.
   * Inclui dados do clube para exibição na timeline.
   */
  app.get('/athletes/:athleteId/affiliations', async (request, reply) => {
    const { athleteId } = request.params as { athleteId: string }

    const rows = await db
      .select({
        id: athleteAffiliations.id,
        athleteId: athleteAffiliations.athleteId,
        clubId: athleteAffiliations.clubId,
        tenantId: athleteAffiliations.tenantId,
        startedAt: athleteAffiliations.startedAt,
        endedAt: athleteAffiliations.endedAt,
        createdAt: athleteAffiliations.createdAt,
        updatedAt: athleteAffiliations.updatedAt,
        clubName: clubs.name,
        clubLogoUrl: clubs.logoUrl,
        clubCity: clubs.city,
        clubState: clubs.state,
      })
      .from(athleteAffiliations)
      .leftJoin(clubs, eq(athleteAffiliations.clubId, clubs.id))
      .where(eq(athleteAffiliations.athleteId, athleteId))
      .orderBy(desc(athleteAffiliations.startedAt))

    return rows
  })

  /**
   * POST /athletes/:athleteId/affiliations
   *
   * Cria uma nova afiliação SEM encerrar as anteriores automaticamente.
   * O front/operador deve encerrar a afiliação anterior antes de criar a nova,
   * ou usar o endpoint de importação que faz isso automaticamente.
   *
   * Regra de negócio: não permite duas afiliações ativas (endedAt = null)
   * para o mesmo atleta no mesmo tenant ao mesmo tempo.
   */
  app.post('/athletes/:athleteId/affiliations', async (request, reply) => {
    const { athleteId } = request.params as { athleteId: string }
    const parseResult = createSchema.safeParse({
      ...(request.body as object),
      athleteId,
    })

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        details: parseResult.error.issues,
      })
    }

    const data = parseResult.data

    // Verifica conflito de afiliação ativa
    if (!data.endedAt) {
      const [active] = await db
        .select({ id: athleteAffiliations.id })
        .from(athleteAffiliations)
        .where(
          and(
            eq(athleteAffiliations.athleteId, athleteId),
            eq(athleteAffiliations.tenantId, data.tenantId),
            isNull(athleteAffiliations.endedAt)
          )
        )

      if (active) {
        return reply.status(409).send({
          error:
            'Já existe uma afiliação ativa para este atleta neste tenant. ' +
            'Encerre a afiliação atual antes de criar uma nova, ou informe endedAt para a nova.',
          code: 'ACTIVE_AFFILIATION_EXISTS',
        })
      }
    }

    const id = randomUUID()
    await db.insert(athleteAffiliations).values({
      id,
      athleteId: data.athleteId,
      clubId: data.clubId,
      tenantId: data.tenantId,
      startedAt: data.startedAt,
      endedAt: data.endedAt ?? null,
    })

    const [created] = await db
      .select()
      .from(athleteAffiliations)
      .where(eq(athleteAffiliations.id, id))

    return reply.status(201).send(created)
  })

  /**
   * PATCH /affiliations/:id
   *
   * Edita uma afiliação existente (datas e/ou clube).
   * Permite corrigir startedAt, encerrar com endedAt, ou trocar de clube.
   * Não exclui: o histórico é imutável, apenas corrigível.
   */
  app.patch('/affiliations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = updateSchema.safeParse(request.body)

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        details: parseResult.error.issues,
      })
    }

    const data = parseResult.data

    const [existing] = await db
      .select()
      .from(athleteAffiliations)
      .where(eq(athleteAffiliations.id, id))

    if (!existing) {
      return reply.status(404).send({ error: 'Afiliação não encontrada' })
    }

    await db
      .update(athleteAffiliations)
      .set({
        ...(data.startedAt ? { startedAt: data.startedAt } : {}),
        ...(data.endedAt !== undefined ? { endedAt: data.endedAt } : {}),
        ...(data.clubId ? { clubId: data.clubId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(athleteAffiliations.id, id))

    const [updated] = await db
      .select()
      .from(athleteAffiliations)
      .where(eq(athleteAffiliations.id, id))

    return updated
  })

  /**
   * DELETE /affiliations/:id
   *
   * Remove permanentemente uma afiliação.
   * Usar com cautela — prefira encerrar com endedAt.
   */
  app.delete('/affiliations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const [existing] = await db
      .select({ id: athleteAffiliations.id })
      .from(athleteAffiliations)
      .where(eq(athleteAffiliations.id, id))

    if (!existing) {
      return reply.status(404).send({ error: 'Afiliação não encontrada' })
    }

    await db
      .delete(athleteAffiliations)
      .where(eq(athleteAffiliations.id, id))

    return reply.status(204).send()
  })
}
