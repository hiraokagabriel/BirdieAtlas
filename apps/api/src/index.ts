import Fastify from 'fastify'
import cors from '@fastify/cors'
import { athletesRoutes } from './routes/athletes'
import { clubsRoutes } from './routes/clubs'
import { tournamentsRoutes } from './routes/tournaments'
import { drawsRoutes } from './routes/draws'
import { rankingsRoutes } from './routes/rankings'
import { dashboardRoutes } from './routes/dashboard'
import { affiliationsRoutes } from './routes/affiliations'
import { importRoutes } from './routes/import'
import { importAthletesRoutes } from './routes/import-athletes'
import { tenantsRoutes } from './routes/tenants'
import { pointsTablesRoutes } from './routes/points-tables'
import { pointRulesRoutes } from './routes/point-rules'
import { pairsRoutes } from './routes/pairs'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

await app.register(athletesRoutes)
await app.register(clubsRoutes)
await app.register(tournamentsRoutes)
await app.register(drawsRoutes)
await app.register(rankingsRoutes)
await app.register(dashboardRoutes)
await app.register(affiliationsRoutes)
await app.register(importRoutes)
await app.register(importAthletesRoutes)
await app.register(tenantsRoutes)
await app.register(pointsTablesRoutes)
await app.register(pointRulesRoutes)
await app.register(pairsRoutes)

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
