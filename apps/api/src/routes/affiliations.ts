import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { athleteAffiliations, clubs, athletes } from '../db/schema.js'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { changeAthleteClubBodySchema } from '@birdie-atlas/validators'
import { fold, toSlug } from '../domain/tournament-import.js'
import { getDefaultTenantId } from '../tenant.js'

const createSchema = z.object({
  athleteId: z.string().min(1),
  clubId: z.string().min(1),
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
   * PUT /athletes/:athleteId/current-club
   *
   * Troca simplificada do clube atual (correção rápida pelo admin): `clubId` de um clube existente,
   * `clubName` para um clube novo (reaproveita o de mesmo nome) ou `clubId: null` para ficar sem clube.
   * Com afiliação ativa, ela é corrigida (mesmo início); sem, cria uma começando hoje.
   */
  app.put('/athletes/:athleteId/current-club', async (request, reply) => {
    const { athleteId } = request.params as { athleteId: string }
    const body = changeAthleteClubBodySchema.parse(request.body)
    const tenantId = await getDefaultTenantId()

    const [athlete] = await db.select({ id: athletes.id }).from(athletes).where(and(eq(athletes.id, athleteId), isNull(athletes.deletedAt)))
    if (!athlete) return reply.status(404).send({ error: 'Atleta não encontrado.', code: 'ATHLETE_NOT_FOUND' })

    const today = new Date().toISOString().slice(0, 10)
    const result = await db.transaction(async (tx): Promise<{ clubId: string | null; error?: undefined } | { error: string; code: string; status: 404 }> => {
      let clubId: string | null = body.clubId ?? null
      if (body.clubId) {
        const [club] = await tx.select({ id: clubs.id }).from(clubs).where(and(eq(clubs.id, body.clubId), eq(clubs.tenantId, tenantId), isNull(clubs.deletedAt)))
        if (!club) return { error: 'Clube não encontrado.', code: 'CLUB_NOT_FOUND', status: 404 }
      } else if (body.clubName) {
        const all = await tx.select({ id: clubs.id, name: clubs.name, slug: clubs.slug }).from(clubs).where(and(eq(clubs.tenantId, tenantId), isNull(clubs.deletedAt)))
        const wanted = fold(body.clubName)
        const existing = all.find((c) => fold(c.name) === wanted)
        if (existing) clubId = existing.id
        else {
          const base = toSlug(body.clubName) || 'clube'
          const taken = new Set(all.map((c) => c.slug))
          let slug = base
          for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
          clubId = randomUUID()
          await tx.insert(clubs).values({ id: clubId, tenantId, name: body.clubName, slug })
        }
      }

      const [active] = await tx.select().from(athleteAffiliations)
        .where(and(eq(athleteAffiliations.athleteId, athleteId), eq(athleteAffiliations.tenantId, tenantId), isNull(athleteAffiliations.endedAt)))
      if (clubId === null) {
        if (active) await tx.update(athleteAffiliations).set({ endedAt: today, updatedAt: new Date() }).where(eq(athleteAffiliations.id, active.id))
      } else if (active) {
        if (active.clubId !== clubId) await tx.update(athleteAffiliations).set({ clubId, updatedAt: new Date() }).where(eq(athleteAffiliations.id, active.id))
      } else {
        await tx.insert(athleteAffiliations).values({ id: randomUUID(), athleteId, clubId, tenantId, startedAt: today, endedAt: null })
      }
      return { clubId }
    })

    if (result.error !== undefined) return reply.status(result.status).send({ error: result.error, code: result.code })
    return { athleteId, clubId: result.clubId }
  })

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
    const tenantId = await getDefaultTenantId()

    // Verifica conflito de afiliação ativa
    if (!data.endedAt) {
      const [active] = await db
        .select({ id: athleteAffiliations.id })
        .from(athleteAffiliations)
        .where(
          and(
            eq(athleteAffiliations.athleteId, athleteId),
            eq(athleteAffiliations.tenantId, tenantId),
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
      tenantId,
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
