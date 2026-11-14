import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import type { ServerConfig } from '../domain/server-config.js'

/**
 * Requisições por minuto e por IP em produção, em baldes separados para escrita e leitura: as leituras do SSR
 * (poucos IPs de saída da Vercel) e dos aparelhos do ginásio atrás de um NAT não podem bloquear o operador.
 * Rotas podem pedir limite próprio (`config.rateLimit`) ou sair dele (`false`).
 */
export const WRITE_LIMIT_PER_MINUTE = 300
export const READ_LIMIT_PER_MINUTE = 3000
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

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
    max: (request) => (READ_METHODS.has(request.method) ? READ_LIMIT_PER_MINUTE : WRITE_LIMIT_PER_MINUTE),
    keyGenerator: (request) => `${request.ip}:${READ_METHODS.has(request.method) ? 'leitura' : 'escrita'}`,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error(`Muitas requisições. Tente de novo em ${Math.ceil(context.ttl / 1000)} s.`), {
        statusCode: 429,
        code: 'RATE_LIMITED',
      }),
  })
}
