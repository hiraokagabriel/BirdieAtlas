import type { FastifyRequest, FastifyReply } from 'fastify'

// ---------------------------------------------------------------------------
// Admin Guard — Modo de desenvolvimento
//
// Enquanto o Clerk não está integrado, este guard controla o acesso
// a rotas protegidas via variável de ambiente DEV_ADMIN_MODE.
//
// Como usar:
//   - Ligar:   DEV_ADMIN_MODE=true  (via .env ou PATCH /dev/admin-mode)
//   - Desligar: remover a var ou setar DEV_ADMIN_MODE=false
//
// Em rotas Fastify, use como preHandler:
//   app.post('/rankings', { preHandler: requireAdmin }, handler)
// ---------------------------------------------------------------------------

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isAdminMode = process.env['DEV_ADMIN_MODE'] === 'true'

  if (!isAdminMode) {
    return reply.status(403).send({
      error: 'Acesso negado.',
      code: 'ADMIN_MODE_DISABLED',
      hint: 'Ligue o modo admin em DEV_ADMIN_MODE=true ou via PATCH /dev/admin-mode',
    })
  }
}

// ---------------------------------------------------------------------------
// Rota utilitária: PATCH /dev/admin-mode
// Permite ligar/desligar sem reiniciar o servidor.
// NUNCA expor em produção — registre apenas quando NODE_ENV !== 'production'.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const toggleSchema = z.object({
  enabled: z.boolean(),
})

export async function devAdminModeRoutes(app: FastifyInstance) {
  if (process.env['NODE_ENV'] === 'production') return

  app.patch('/dev/admin-mode', async (request, reply) => {
    const result = toggleSchema.safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'Body inválido', details: result.error.flatten() })
    }

    process.env['DEV_ADMIN_MODE'] = result.data.enabled ? 'true' : 'false'

    return reply.send({
      ok: true,
      adminMode: result.data.enabled,
      message: result.data.enabled
        ? '🟢 Modo admin LIGADO'
        : '🔴 Modo admin DESLIGADO',
    })
  })

  app.get('/dev/admin-mode', async (_request, reply) => {
    return reply.send({
      adminMode: process.env['DEV_ADMIN_MODE'] === 'true',
    })
  })
}
