import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerErrorHandling } from './http/errors.js'
import { adminGuardHook, devAdminModeRoutes } from './middleware/admin-guard.js'
import { athletesRoutes } from './routes/athletes.js'
import { clubsRoutes } from './routes/clubs.js'
import { tournamentsRoutes } from './routes/tournaments.js'
import { drawsRoutes } from './routes/draws.js'
import { rankingsRoutes } from './routes/rankings.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { affiliationsRoutes } from './routes/affiliations.js'
import { importAthletesRoutes } from './routes/import-athletes.js'
import { tenantsRoutes } from './routes/tenants.js'
import { pointsTablesRoutes } from './routes/points-tables.js'
import { pointRulesRoutes } from './routes/point-rules.js'
import { pairsRoutes } from './routes/pairs.js'
import { registrationsRoutes } from './routes/registrations.js'

const app = Fastify({ logger: true })

// O padrão do @fastify/cors só libera GET/HEAD/POST: sem a lista, o navegador bloqueia todo PUT, PATCH e DELETE.
await app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] })

// Precisam vir antes das rotas: hooks e handlers da raiz valem para os plugins registrados depois.
registerErrorHandling(app)
app.addHook('onRequest', adminGuardHook)

await app.register(devAdminModeRoutes)
await app.register(athletesRoutes)
await app.register(clubsRoutes)
await app.register(tournamentsRoutes)
await app.register(drawsRoutes)
await app.register(rankingsRoutes)
await app.register(dashboardRoutes)
await app.register(affiliationsRoutes)
await app.register(importAthletesRoutes)
await app.register(tenantsRoutes)
await app.register(pointsTablesRoutes)
await app.register(pointRulesRoutes)
await app.register(pairsRoutes)
await app.register(registrationsRoutes)

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
