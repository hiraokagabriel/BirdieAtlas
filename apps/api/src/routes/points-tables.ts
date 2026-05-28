import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { pointsTables } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const rowSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
  tournamentLevel: z.string().min(1),
  placement: z.number().int().min(1),
  points: z.number().int().min(0),
})

const bulkSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1),
  tournamentLevel: z.string().min(1),
  rows: z.array(z.object({
    placement: z.number().int().min(1),
    points: z.number().int().min(0),
  })).min(1),
})

export async function pointsTablesRoutes(app: FastifyInstance) {
  app.get('/points-tables', async (request) => {
    const { tenantId } = request.query as { tenantId?: string }
    if (tenantId) return db.select().from(pointsTables).where(eq(pointsTables.tenantId, tenantId))
    return db.select().from(pointsTables)
  })

  // Retorna todas as linhas de uma tabela pelo id de uma linha (agrupa por name+level)
  app.get('/points-tables/:id/rows', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [ref] = await db.select().from(pointsTables).where(eq(pointsTables.id, id))
    if (!ref) return reply.status(404).send({ error: 'Row not found' })
    const rows = await db.select().from(pointsTables)
      .where(and(eq(pointsTables.name, ref.name), eq(pointsTables.tournamentLevel, ref.tournamentLevel), eq(pointsTables.tenantId, ref.tenantId)))
    return rows.sort((a, b) => a.placement - b.placement)
  })

  // Cria ou substitui todas as linhas de uma tabela (name+level+tenantId)
  // Usado pelo setup do torneio para salvar tabela personalizada
  app.post('/points-tables/bulk', async (request, reply) => {
    const body = bulkSchema.parse(request.body)

    // Remove linhas existentes para esse grupo
    const existing = await db.select().from(pointsTables)
      .where(and(
        eq(pointsTables.tenantId, body.tenantId),
        eq(pointsTables.name, body.name),
        eq(pointsTables.tournamentLevel, body.tournamentLevel),
      ))
    if (existing.length) {
      for (const row of existing) {
        await db.delete(pointsTables).where(eq(pointsTables.id, row.id))
      }
    }

    const inserted = await db.insert(pointsTables).values(
      body.rows.map((r) => ({
        id: randomUUID(),
        tenantId: body.tenantId,
        name: body.name,
        tournamentLevel: body.tournamentLevel,
        placement: r.placement,
        points: r.points,
      }))
    ).returning()

    return reply.status(201).send(inserted.sort((a, b) => a.placement - b.placement))
  })

  app.post('/points-tables', async (request, reply) => {
    const body = rowSchema.parse(request.body)
    const [row] = await db.insert(pointsTables).values({ id: randomUUID(), ...body }).returning()
    return reply.status(201).send(row)
  })

  app.put('/points-tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = rowSchema.partial().parse(request.body)
    const [row] = await db.update(pointsTables).set({ ...body, updatedAt: new Date() }).where(eq(pointsTables.id, id)).returning()
    if (!row) return reply.status(404).send({ error: 'Row not found' })
    return row
  })

  app.delete('/points-tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.delete(pointsTables).where(eq(pointsTables.id, id))
    return reply.status(204).send()
  })
}
