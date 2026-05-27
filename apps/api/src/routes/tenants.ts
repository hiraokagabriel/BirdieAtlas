import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { tenants } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  country: z.string().default('BR'),
  logoUrl: z.string().url().optional(),
})

export async function tenantsRoutes(app: FastifyInstance) {
  app.get('/tenants', async () => {
    return db.select().from(tenants)
  })

  app.get('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id))
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })
    return tenant
  })

  app.post('/tenants', async (request, reply) => {
    const body = createTenantSchema.parse(request.body)
    const [tenant] = await db
      .insert(tenants)
      .values({ id: randomUUID(), ...body })
      .returning()
    return reply.status(201).send(tenant)
  })

  app.put('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createTenantSchema.partial().parse(request.body)
    const [tenant] = await db
      .update(tenants)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning()
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })
    return tenant
  })

  app.delete('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.delete(tenants).where(eq(tenants.id, id))
    return reply.status(204).send()
  })
}
