import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerErrorHandling } from './errors.js'
import { READ_LIMIT_PER_MINUTE, WRITE_LIMIT_PER_MINUTE, registerNetwork } from './network.js'
import { readServerConfig } from '../domain/server-config.js'

const prod = readServerConfig({ NODE_ENV: 'production', ADMIN_PIN: 'x'.repeat(16), CORS_ORIGINS: 'https://site.vercel.app', TRUST_PROXY: '0', ADMIN_SESSION_SECRET: 's'.repeat(32) })

async function buildApp(config = prod) {
  const app = Fastify()
  await registerNetwork(app, config)
  registerErrorHandling(app)
  app.get('/publico', async () => ({ ok: true }))
  app.post('/login', { config: { rateLimit: { max: 2, timeWindow: '1 minute' } } }, async () => ({ ok: true }))
  app.get('/stream', { config: { rateLimit: false } }, async () => ({ ok: true }))
  app.put('/escrita', async () => ({ ok: true }))
  return app
}

describe('CORS', () => {
  it('produção: só a origem da lista recebe Access-Control-Allow-Origin', async () => {
    const app = await buildApp()
    const ok = await app.inject({ method: 'GET', url: '/publico', headers: { origin: 'https://site.vercel.app' } })
    expect(ok.headers['access-control-allow-origin']).toBe('https://site.vercel.app')
    const other = await app.inject({ method: 'GET', url: '/publico', headers: { origin: 'https://evil.example' } })
    expect(other.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('desenvolvimento: reflete qualquer origem', async () => {
    const app = await buildApp(readServerConfig({}))
    const res = await app.inject({ method: 'GET', url: '/publico', headers: { origin: 'http://192.168.0.10:3000' } })
    expect(res.headers['access-control-allow-origin']).toBe('http://192.168.0.10:3000')
  })
})

describe('limite de requisições', () => {
  it('produção: rota com limite próprio responde 429 no contrato de erro, com Retry-After', async () => {
    const app = await buildApp()
    for (let i = 0; i < 2; i++) expect((await app.inject({ method: 'POST', url: '/login' })).statusCode).toBe(200)
    const blocked = await app.inject({ method: 'POST', url: '/login' })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json()).toMatchObject({ code: 'RATE_LIMITED', error: expect.stringContaining('Muitas requisições') })
    expect(blocked.headers['retry-after']).toBeDefined()
  })

  it('leitura e escrita em baldes separados, com tetos diferentes', async () => {
    const app = await buildApp()
    expect((await app.inject({ method: 'GET', url: '/publico' })).headers['x-ratelimit-limit']).toBe(String(READ_LIMIT_PER_MINUTE))
    for (let i = 0; i < WRITE_LIMIT_PER_MINUTE; i++) await app.inject({ method: 'PUT', url: '/escrita' })
    expect((await app.inject({ method: 'PUT', url: '/escrita' })).statusCode).toBe(429)
    // O balde de escrita esgotado não bloqueia as leituras do mesmo IP.
    expect((await app.inject({ method: 'GET', url: '/publico' })).statusCode).toBe(200)
  })

  it('rota fora do limite e desenvolvimento sem limite', async () => {
    const app = await buildApp()
    expect((await app.inject({ method: 'GET', url: '/stream' })).headers['x-ratelimit-limit']).toBeUndefined()
    const dev = await buildApp(readServerConfig({}))
    for (let i = 0; i < 3; i++) expect((await dev.inject({ method: 'POST', url: '/login' })).statusCode).toBe(200)
  })
})
