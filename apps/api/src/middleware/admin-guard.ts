import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { AdminSessions, bearerToken, parseAdminPin } from '../domain/admin-session.js'

// ---------------------------------------------------------------------------
// Admin Guard
//
// Enquanto o Clerk não está integrado, há dois modos:
// - Sem ADMIN_PIN (desenvolvimento, E2E): o modo admin é global, controlado por
//   DEV_ADMIN_MODE (via .env ou PATCH /dev/admin-mode).
// - Com ADMIN_PIN (rede local): só a requisição com token de sessão válido
//   (`Authorization: Bearer`, obtido em POST /admin/session) é admin.
//   DEV_ADMIN_MODE é ignorado e PATCH /dev/admin-mode responde 403.
//
// O guard roda como hook global (ver adminGuardHook): toda escrita exige admin,
// e leituras com dados pessoais (ano de nascimento) e notas internas também.
// ---------------------------------------------------------------------------

const READ_METHODS = new Set(['GET', 'HEAD'])

/** Leituras que devolvem dados pessoais de atletas ou notas internas: só para admin. */
const ADMIN_ONLY_READS = new Set([
  '/athletes',
  '/athletes/export.csv',
  '/clubs/:id/athletes/export.csv',
  '/athletes/:id',
  '/registrations/tournament/:tournamentId',
  '/draws/matches/:matchId/result-history',
  '/tournaments/:id/registrations/export.csv',
])

/** Rotas que controlam o próprio acesso admin ficam fora do guard. */
const GUARD_EXEMPT = new Set(['/dev/admin-mode', '/admin/session'])

let adminSessions: AdminSessions | null = null

/** Liga (PIN válido) ou desliga (vazio) o modo PIN. Chamado na subida da API; PIN curto lança erro. */
export function configureAdminPin(raw: string | undefined): boolean {
  const pin = parseAdminPin(raw)
  adminSessions = pin ? new AdminSessions(pin) : null
  return adminSessions !== null
}

function isAdminRequest(request: FastifyRequest): boolean {
  if (adminSessions) return adminSessions.isValid(bearerToken(request.headers.authorization))
  return process.env['DEV_ADMIN_MODE'] === 'true'
}

export function requiresAdmin(method: string, routeUrl: string | undefined): boolean {
  // Preflight CORS nunca carrega credenciais nem altera dados.
  if (method === 'OPTIONS') return false
  if (routeUrl === undefined || GUARD_EXEMPT.has(routeUrl)) return false
  if (!READ_METHODS.has(method)) return true
  return ADMIN_ONLY_READS.has(routeUrl)
}

export async function adminGuardHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!requiresAdmin(request.method, request.routeOptions.url)) return
  if (isAdminRequest(request)) return

  return reply.status(403).send({
    error: 'Acesso negado: esta operação exige o modo admin.',
    code: 'ADMIN_MODE_DISABLED',
    details: {
      hint: adminSessions
        ? 'Entre como admin com o PIN (botão no canto da tela) e tente de novo.'
        : 'Ligue DEV_ADMIN_MODE=true no .env da API ou use o botão de modo admin no painel.',
    },
  })
}

// ---------------------------------------------------------------------------
// GET/POST/DELETE /admin/session — estado, entrada com PIN e saída.
// ---------------------------------------------------------------------------

const loginSchema = z.object({ pin: z.string().trim().min(1).max(64) })

export async function adminSessionRoutes(app: FastifyInstance) {
  app.get('/admin/session', async (request) => ({ pinRequired: adminSessions !== null, admin: isAdminRequest(request) }))

  app.post('/admin/session', async (request, reply) => {
    const { pin } = loginSchema.parse(request.body)
    if (!adminSessions) {
      return reply.status(409).send({ error: 'O PIN de admin não está configurado nesta API.', code: 'ADMIN_PIN_NOT_CONFIGURED' })
    }
    const result = adminSessions.login(pin, request.ip)
    if (result.ok) return { token: result.token, expiresAt: result.expiresAt.toISOString() }
    if (result.reason === 'locked') {
      const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000)
      return reply.status(429).header('Retry-After', String(retryAfterSeconds)).send({
        error: `Muitas tentativas com PIN errado. Tente de novo em ${retryAfterSeconds} s.`,
        code: 'TOO_MANY_ATTEMPTS',
        details: { retryAfterSeconds },
      })
    }
    return reply.status(401).send({ error: 'PIN incorreto.', code: 'INVALID_PIN' })
  })

  app.delete('/admin/session', async (request, reply) => {
    adminSessions?.revoke(bearerToken(request.headers.authorization))
    return reply.status(204).send()
  })
}

// ---------------------------------------------------------------------------
// PATCH/GET /dev/admin-mode — liga/desliga sem reiniciar o servidor.
// Não é registrada em produção. Com ADMIN_PIN, o PATCH é recusado.
// ---------------------------------------------------------------------------

const toggleSchema = z.object({
  enabled: z.boolean(),
})

export async function devAdminModeRoutes(app: FastifyInstance) {
  if (process.env['NODE_ENV'] === 'production') return

  app.patch('/dev/admin-mode', async (request, reply) => {
    const { enabled } = toggleSchema.parse(request.body)
    if (adminSessions) {
      return reply.status(403).send({
        error: 'Com PIN de admin configurado, o modo admin global fica desligado. Entre com o PIN.',
        code: 'ADMIN_PIN_ENABLED',
      })
    }
    process.env['DEV_ADMIN_MODE'] = enabled ? 'true' : 'false'
    return reply.send({ adminMode: enabled })
  })

  app.get('/dev/admin-mode', async (request, reply) => {
    return reply.send({ adminMode: isAdminRequest(request) })
  })
}
