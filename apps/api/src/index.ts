import Fastify from 'fastify'
import cors from '@fastify/cors'
import { tenantsRoutes } from './routes/tenants'
import { clubsRoutes } from './routes/clubs'
import { athletesRoutes } from './routes/athletes'
import { tournamentsRoutes } from './routes/tournaments'
import { drawsRoutes } from './routes/draws'

const app = Fastify({ logger: true })

await app.register(cors)

app.get('/health', async () => ({ ok: true }))

await app.register(tenantsRoutes)
await app.register(clubsRoutes)
await app.register(athletesRoutes)
await app.register(tournamentsRoutes)
await app.register(drawsRoutes)

await app.listen({ port: 3001, host: '0.0.0.0' })
