import type { FastifyError, FastifyInstance } from 'fastify'
import type { ApiErrorBody } from '@birdie-atlas/types'
import { ZodError } from 'zod'

/**
 * Todo erro sai no contrato `{ error, code?, details? }`:
 * - Zod (input inválido) → 400 VALIDATION_ERROR com os campos
 * - erros do Fastify com status < 500 (JSON malformado, content-type…) → status e código originais
 * - qualquer outro → 500 INTERNAL_ERROR, sem vazar mensagem interna
 */
export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler<FastifyError | ZodError>((error, request, reply) => {
    if (error instanceof ZodError) {
      const body: ApiErrorBody = { error: 'Dados inválidos.', code: 'VALIDATION_ERROR', details: error.flatten() }
      return reply.status(400).send(body)
    }

    const statusCode = error.statusCode ?? 500
    if (statusCode < 500) {
      const body: ApiErrorBody = { error: error.message, code: error.code }
      return reply.status(statusCode).send(body)
    }

    request.log.error(error)
    const body: ApiErrorBody = { error: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' }
    return reply.status(500).send(body)
  })

  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = { error: `Rota não encontrada: ${request.method} ${request.url}`, code: 'NOT_FOUND' }
    return reply.status(404).send(body)
  })
}
