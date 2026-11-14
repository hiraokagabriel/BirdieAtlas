import { describe, expect, it } from 'vitest'
import { readServerConfig } from './server-config.js'

const prod = { NODE_ENV: 'production', ADMIN_PIN: 'x'.repeat(16), CORS_ORIGINS: 'https://birdieatlas.vercel.app' }

describe('readServerConfig', () => {
  it('fora de produção: qualquer origem, sem proxy, sem exigir PIN', () => {
    expect(readServerConfig({})).toEqual({ production: false, trustProxy: 0, corsOrigin: true })
    expect(readServerConfig({ DEV_ADMIN_MODE: 'true', TRUST_PROXY: '1' }).trustProxy).toBe(1)
  })

  it('produção válida: lista de origens, com curinga de subdomínio', () => {
    const config = readServerConfig({ ...prod, CORS_ORIGINS: 'https://birdieatlas.vercel.app, https://birdieatlas-*.vercel.app', TRUST_PROXY: '1' })
    expect(config.production).toBe(true)
    expect(config.trustProxy).toBe(1)
    const [exact, preview] = config.corsOrigin as [string, RegExp]
    expect(exact).toBe('https://birdieatlas.vercel.app')
    expect(preview.test('https://birdieatlas-git-feat-x.vercel.app')).toBe(true)
    expect(preview.test('https://evil.com/?https://birdieatlas-x.vercel.app')).toBe(false)
    expect(preview.test('https://birdieatlas-a.b.vercel.app')).toBe(false)
    // O ponto é literal: "vercelXapp" não passa.
    expect(preview.test('https://birdieatlas-x.vercelXapp')).toBe(false)
  })

  it('produção recusa modo admin global, PIN curto ou ausente e falta de origens, listando tudo', () => {
    expect(() => readServerConfig({ NODE_ENV: 'production', DEV_ADMIN_MODE: 'true', ADMIN_PIN: '12345678' })).toThrow(
      /DEV_ADMIN_MODE=true é proibido[\s\S]*ADMIN_PIN é obrigatório[\s\S]*CORS_ORIGINS é obrigatório/,
    )
    expect(() => readServerConfig({ ...prod, ADMIN_PIN: '' })).toThrow(/ADMIN_PIN/)
  })

  it('TRUST_PROXY inválido', () => {
    expect(() => readServerConfig({ TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/)
    expect(() => readServerConfig({ TRUST_PROXY: '-1' })).toThrow(/TRUST_PROXY/)
  })
})
