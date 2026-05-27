import Fastify from 'fastify'
import cors from '@fastify/cors'
import { tournamentsRoutes } from './routes/tournaments'
import { athletesRoutes } from './routes/athletes'
import { clubsRoutes } from './routes/clubs'
import { drawsRoutes } from './routes/draws'
import { tenantsRoutes } from './routes/tenants'
import { rankingsRoutes } from './routes/rankings'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

await app.register(tournamentsRoutes)
await app.register(athletesRoutes)
await app.register(clubsRoutes)
await app.register(drawsRoutes)
await app.register(tenantsRoutes)
await app.register(rankingsRoutes)

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.log(`🚀 API running on http://localhost:${port}`)
