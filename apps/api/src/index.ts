import Fastify from 'fastify'
import cors from '@fastify/cors'
import { tournamentsRoutes } from './routes/tournaments'
import { athletesRoutes } from './routes/athletes'
import { clubsRoutes } from './routes/clubs'
import { drawsRoutes } from './routes/draws'
import { tenantsRoutes } from './routes/tenants'
import { rankingsRoutes } from './routes/rankings'
import { dashboardRoutes } from './routes/dashboard'
import { pointsTablesRoutes } from './routes/points-tables'
import { devAdminModeRoutes } from './middleware/admin-guard'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

await app.register(tournamentsRoutes)
await app.register(athletesRoutes)
await app.register(clubsRoutes)
await app.register(drawsRoutes)
await app.register(tenantsRoutes)
await app.register(rankingsRoutes)
await app.register(dashboardRoutes)
await app.register(pointsTablesRoutes)

// Rota utilitária de dev — registrada automaticamente apenas fora de produção
await app.register(devAdminModeRoutes)

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.log(`🚀 API running on http://localhost:${port}`)
