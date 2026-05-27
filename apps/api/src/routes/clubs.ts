import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { clubs } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const createClubSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  tenantId: z.string(),
  city: z.string().optional(),
  state: z.string().optional(),
  logoUrl: z.string().url().optional(),
})

export async function clubsRoutes(app: FastifyInstance) {
  app.get('/clubs', async (request) => {
    const { tenantId } = request.query as { tenantId?: string }
    if (tenantId) {
      return db.select().from(clubs).where(eq(clubs.tenantId, tenantId))
    }
    return db.select().from(clubs)
  })

  app.get('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id))
    if (!club) return reply.status(404).send({ error: 'Club not found' })
    return club
  })

  app.post('/clubs', async (request, reply) => {
    const body = createClubSchema.parse(request.body)
    const [club] = await db
      .insert(clubs)
      .values({ id: randomUUID(), ...body })
      .returning()
    return reply.status(201).send(club)
  })

  app.put('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createClubSchema.partial().parse(request.body)
    const [club] = await db
      .update(clubs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(clubs.id, id))
      .returning()
    if (!club) return reply.status(404).send({ error: 'Club not found' })
    return club
  })

  app.delete('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.delete(clubs).where(eq(clubs.id, id))
    return reply.status(204).send()
  })
}
