import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'
import { eq, asc, count } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { paginationQuerySchema } from '@birdie-atlas/validators'
import { paginate } from '../domain/pagination.js'

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  country: z.string().default('BR'),
  logoUrl: z.string().url().optional(),
})

export async function tenantsRoutes(app: FastifyInstance) {
  app.get('/tenants', async (request) => {
    const query = paginationQuerySchema.parse(request.query)
    return paginate(
      query,
      (limit, offset) => db.select().from(tenants).orderBy(asc(tenants.name), asc(tenants.id)).limit(limit).offset(offset),
      async () => (await db.select({ total: count() }).from(tenants))[0]?.total ?? 0,
    )
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
