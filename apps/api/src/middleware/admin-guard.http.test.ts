import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerErrorHandling } from '../http/errors.js'
import { adminGuardHook, adminSessionRoutes, configureAdminPin, devAdminModeRoutes } from './admin-guard.js'
import { registerNetwork } from '../http/network.js'
import { readServerConfig } from '../domain/server-config.js'

// Guard e sessão de admin pela pilha HTTP do Fastify, sem banco: uma escrita e uma leitura pública de mentira.

async function buildApp() {
  const app = Fastify()
  registerErrorHandling(app)
  app.addHook('onRequest', adminGuardHook)
  await app.register(devAdminModeRoutes)
  await app.register(adminSessionRoutes)
  app.post('/escrita', async () => ({ ok: true }))
  app.get('/publico', async () => ({ ok: true }))
  return app
}

const PIN = '13579024'
// Alias: o lint do turbo cobra variáveis de ambiente lidas direto de process.env.
const env = process.env as { DEV_ADMIN_MODE?: string }
let savedDevMode: string | undefined

beforeEach(() => { savedDevMode = env.DEV_ADMIN_MODE })
afterEach(() => {
  configureAdminPin(undefined)
  if (savedDevMode === undefined) delete env.DEV_ADMIN_MODE
  else env.DEV_ADMIN_MODE = savedDevMode
})

describe('sem ADMIN_PIN (modo global de desenvolvimento)', () => {
  it('segue DEV_ADMIN_MODE e não aceita login', async () => {
    configureAdminPin(undefined)
    env.DEV_ADMIN_MODE = 'true'
    const app = await buildApp()
    expect((await app.inject({ method: 'POST', url: '/escrita' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/admin/session' })).json()).toEqual({ pinRequired: false, admin: true })
    const login = await app.inject({ method: 'POST', url: '/admin/session', payload: { pin: PIN } })
    expect(login.statusCode).toBe(409)
    expect(login.json().code).toBe('ADMIN_PIN_NOT_CONFIGURED')
  })
})

describe('com ADMIN_PIN', () => {
  it('escrita sem token é 403 mesmo com DEV_ADMIN_MODE=true; leitura pública segue livre', async () => {
    configureAdminPin(PIN)
    env.DEV_ADMIN_MODE = 'true'
    const app = await buildApp()
    const denied = await app.inject({ method: 'POST', url: '/escrita' })
    expect(denied.statusCode).toBe(403)
    expect(denied.json().code).toBe('ADMIN_MODE_DISABLED')
    expect((await app.inject({ method: 'GET', url: '/publico' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/admin/session' })).json()).toEqual({ pinRequired: true, admin: false })
  })

  it('PIN certo dá token; com ele a escrita passa; sair revoga', async () => {
    configureAdminPin(PIN)
    const app = await buildApp()
    const login = await app.inject({ method: 'POST', url: '/admin/session', payload: { pin: PIN } })
    expect(login.statusCode).toBe(200)
    const { token, expiresAt } = login.json() as { token: string; expiresAt: string }
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now())
    const authorization = `Bearer ${token}`

    expect((await app.inject({ method: 'POST', url: '/escrita', headers: { authorization } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/admin/session', headers: { authorization } })).json()).toEqual({ pinRequired: true, admin: true })

    expect((await app.inject({ method: 'DELETE', url: '/admin/session', headers: { authorization } })).statusCode).toBe(204)
    expect((await app.inject({ method: 'POST', url: '/escrita', headers: { authorization } })).statusCode).toBe(403)
  })

  it('PIN errado é 401; o quinto erro seguido é 429 com Retry-After', async () => {
    configureAdminPin(PIN)
    const app = await buildApp()
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({ method: 'POST', url: '/admin/session', payload: { pin: '00000000' } })
      expect(res.statusCode).toBe(401)
      expect(res.json().code).toBe('INVALID_PIN')
    }
    const locked = await app.inject({ method: 'POST', url: '/admin/session', payload: { pin: '00000000' } })
    expect(locked.statusCode).toBe(429)
    expect(locked.json().code).toBe('TOO_MANY_ATTEMPTS')
    expect(locked.headers['retry-after']).toBe('60')
  })

  it('espaços nas pontas do PIN digitado são ignorados', async () => {
    configureAdminPin(PIN)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/session', payload: { pin: ` ${PIN} ` } })
    expect(res.statusCode).toBe(200)
  })

  it('corpo inválido é 400 VALIDATION_ERROR', async () => {
    configureAdminPin(PIN)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/admin/session', payload: {} })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION_ERROR')
  })

  it('o PATCH /dev/admin-mode é recusado e não liga o modo global', async () => {
    configureAdminPin(PIN)
    env.DEV_ADMIN_MODE = 'false'
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/dev/admin-mode', payload: { enabled: true } })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('ADMIN_PIN_ENABLED')
    expect(env.DEV_ADMIN_MODE).toBe('false')
  })
})

describe('produção: limite de tentativas de login', () => {
  it('a 11ª tentativa no mesmo minuto responde 429, antes do bloqueio por PIN errado', async () => {
    configureAdminPin('a'.repeat(16))
    const app = Fastify()
    await registerNetwork(app, readServerConfig({ NODE_ENV: 'production', ADMIN_PIN: 'a'.repeat(16), CORS_ORIGINS: 'https://site.vercel.app', TRUST_PROXY: '0', ADMIN_SESSION_SECRET: 's'.repeat(32) }))
    registerErrorHandling(app)
    await app.register(adminSessionRoutes)
    // O PIN certo não esgota o bloqueio de 5 erros: o que barra aqui é o limite da rota.
    for (let i = 0; i < 10; i++) expect((await app.inject({ method: 'POST', url: '/admin/session', payload: { pin: 'a'.repeat(16) } })).statusCode).toBe(200)
    const blocked = await app.inject({ method: 'POST', url: '/admin/session', payload: { pin: 'a'.repeat(16) } })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json().code).toBe('RATE_LIMITED')
  })
})
