import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import type { ServerConfig } from '../domain/server-config.js'

/** Requisições por minuto e por IP em produção. Rotas podem pedir menos (`config.rateLimit`) ou sair (`false`). */
export const RATE_LIMIT_PER_MINUTE = 300

/**
 * CORS e limite de requisições. O limite só vale em produção: em desenvolvimento e no E2E todas as chamadas
 * vêm do mesmo IP. Em memória, que basta com uma instância só da API.
 */
export async function registerNetwork(app: FastifyInstance, config: ServerConfig) {
  // O padrão do @fastify/cors só libera GET/HEAD/POST: sem a lista, o navegador bloqueia todo PUT, PATCH e DELETE.
  // `exposedHeaders`: sem ele o navegador esconde o nome do arquivo dos downloads CSV (Content-Disposition) do JavaScript.
  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
  })

  if (!config.production) return
  await app.register(rateLimit, {
    max: RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error(`Muitas requisições. Tente de novo em ${Math.ceil(context.ttl / 1000)} s.`), {
        statusCode: 429,
        code: 'RATE_LIMITED',
      }),
  })
}
