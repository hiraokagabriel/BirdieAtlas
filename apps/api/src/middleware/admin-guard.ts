import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Admin Guard — Modo de desenvolvimento
//
// Enquanto o Clerk não está integrado, o acesso administrativo é controlado
// pela variável DEV_ADMIN_MODE (via .env ou PATCH /dev/admin-mode).
//
// O guard roda como hook global (ver adminGuardHook): toda escrita exige admin,
// e leituras com dados pessoais (e-mail, data de nascimento) também.
// ---------------------------------------------------------------------------

const READ_METHODS = new Set(['GET', 'HEAD'])

/** Leituras que devolvem dados pessoais de atletas ou notas internas: só para admin. */
const ADMIN_ONLY_READS = new Set([
  '/athletes',
  '/athletes/:id',
  '/registrations/tournament/:tournamentId',
  '/tournaments/:id/registrations/export.csv',
  '/tournaments/:id/results/export.csv',
  '/tournaments/:id/schedule/export.csv',
  '/tournaments/:id/podium/export.csv',
  '/clubs/:id/athletes/export.csv',
])

/** Rotas que controlam o próprio modo admin ficam fora do guard. */
const GUARD_EXEMPT = new Set(['/dev/admin-mode'])

function isAdminMode(): boolean {
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
  if (isAdminMode()) return

  return reply.status(403).send({
    error: 'Acesso negado: esta operação exige o modo admin.',
    code: 'ADMIN_MODE_DISABLED',
    details: { hint: 'Ligue DEV_ADMIN_MODE=true no .env da API ou use o botão de modo admin no painel.' },
  })
}

// ---------------------------------------------------------------------------
// PATCH/GET /dev/admin-mode — liga/desliga sem reiniciar o servidor.
// Não é registrada em produção.
// ---------------------------------------------------------------------------

const toggleSchema = z.object({
  enabled: z.boolean(),
})

export async function devAdminModeRoutes(app: FastifyInstance) {
  if (process.env['NODE_ENV'] === 'production') return

  app.patch('/dev/admin-mode', async (request, reply) => {
    const { enabled } = toggleSchema.parse(request.body)
    process.env['DEV_ADMIN_MODE'] = enabled ? 'true' : 'false'
    return reply.send({ adminMode: enabled })
  })

  app.get('/dev/admin-mode', async (_request, reply) => {
    return reply.send({ adminMode: isAdminMode() })
  })
}
