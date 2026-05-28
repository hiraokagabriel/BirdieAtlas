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

export async function pointsTablesRoutes(app: FastifyInstance) {
  // Lista todas as tabelas do tenant
  app.get('/points-tables', async (request) => {
    const { tenantId } = request.query as { tenantId?: string }
    if (tenantId) {
      return db.select().from(pointsTables).where(eq(pointsTables.tenantId, tenantId))
    }
    return db.select().from(pointsTables)
  })

  // Cria uma linha
  app.post('/points-tables', async (request, reply) => {
    const body = rowSchema.parse(request.body)
    const [row] = await db.insert(pointsTables).values({ id: randomUUID(), ...body }).returning()
    return reply.status(201).send(row)
  })

  // Atualiza uma linha
  app.put('/points-tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = rowSchema.partial().parse(request.body)
    const [row] = await db
      .update(pointsTables)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(pointsTables.id, id))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Row not found' })
    return row
  })

  // Remove uma linha
  app.delete('/points-tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.delete(pointsTables).where(eq(pointsTables.id, id))
    return reply.status(204).send()
  })
}
