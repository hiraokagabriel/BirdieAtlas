import 'dotenv/config'
import Fastify from 'fastify'
import { registerErrorHandling } from './http/errors.js'
import { registerNetwork } from './http/network.js'
import { readServerConfig } from './domain/server-config.js'
import { adminGuardHook, adminSessionRoutes, configureAdminPin, devAdminModeRoutes } from './middleware/admin-guard.js'
import { athletesRoutes } from './routes/athletes.js'
import { athleteStatsRoutes } from './routes/athlete-stats.js'
import { clubsRoutes } from './routes/clubs.js'
import { tournamentsRoutes } from './routes/tournaments.js'
import { drawsRoutes } from './routes/draws.js'
import { scheduleRoutes } from './routes/schedule.js'
import { liveRoutes } from './routes/live.js'
import { rankingsRoutes } from './routes/rankings.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { affiliationsRoutes } from './routes/affiliations.js'
import { tenantsRoutes } from './routes/tenants.js'
import { pointRulesRoutes } from './routes/point-rules.js'
import { pairsRoutes } from './routes/pairs.js'
import { registrationsRoutes } from './routes/registrations.js'
import { guestsRoutes } from './routes/guests.js'
import { playersRoutes } from './routes/players.js'
import { guestMergeRoutes } from './routes/guest-merge.js'
import { reportsRoutes } from './routes/reports.js'
import { importTournamentRoutes } from './routes/import-tournament.js'

// Em produção, configuração insegura (modo admin global, PIN curto, sem CORS_ORIGINS) impede a subida.
const config = readServerConfig(process.env)
// TRUST_PROXY: quantos proxies há na frente (0 = IP do socket). O bloqueio de PIN e o rate limit usam esse IP.
const app = Fastify({ logger: true, trustProxy: config.trustProxy })

// Com ADMIN_PIN, o acesso admin passa a ser por sessão (PIN); PIN curto impede a subida.
if (configureAdminPin(process.env['ADMIN_PIN'], process.env['ADMIN_SESSION_SECRET']?.trim())) app.log.info('PIN de admin ativo: DEV_ADMIN_MODE é ignorado.')

await registerNetwork(app, config)

// Precisam vir antes das rotas: hooks e handlers da raiz valem para os plugins registrados depois.
registerErrorHandling(app)
app.addHook('onRequest', adminGuardHook)

// Saúde para o provedor e o keep-alive: não toca o banco (o Neon pode dormir).
app.get('/health', { config: { rateLimit: false } }, async () => ({ ok: true }))
await app.register(devAdminModeRoutes)
await app.register(adminSessionRoutes)
await app.register(athletesRoutes)
await app.register(athleteStatsRoutes)
await app.register(clubsRoutes)
await app.register(tournamentsRoutes)
await app.register(drawsRoutes)
await app.register(scheduleRoutes)
await app.register(liveRoutes)
await app.register(rankingsRoutes)
await app.register(dashboardRoutes)
await app.register(affiliationsRoutes)
await app.register(tenantsRoutes)
await app.register(pointRulesRoutes)
await app.register(pairsRoutes)
await app.register(registrationsRoutes)
await app.register(guestsRoutes)
await app.register(playersRoutes)
await app.register(guestMergeRoutes)
await app.register(reportsRoutes)
await app.register(importTournamentRoutes)

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API rodando em http://localhost:${port}`)
