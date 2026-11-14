import { describe, expect, it } from 'vitest'
import {
  ADMIN_SESSION_TTL_MS, AdminSessions, MAX_FAILED_PIN_ATTEMPTS, PIN_LOCKOUT_MS, bearerToken, parseAdminPin,
} from './admin-session.js'

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

describe('parseAdminPin', () => {
  it('vazio ou ausente desliga o modo PIN', () => {
    expect(parseAdminPin(undefined)).toBeNull()
    expect(parseAdminPin('  ')).toBeNull()
  })
  it('curto demais impede a API de subir', () => {
    expect(() => parseAdminPin('1234567')).toThrow(/8 caracteres/)
  })
  it('aceita 8 ou mais, sem espaços nas pontas', () => {
    expect(parseAdminPin(' 12345678 ')).toBe('12345678')
  })
})

describe('AdminSessions', () => {
  it('PIN certo gera token válido; errado não', () => {
    const s = new AdminSessions('24681012')
    expect(s.login('00000000', 'ip')).toEqual({ ok: false, reason: 'invalid_pin' })
    const ok = s.login('24681012', 'ip')
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(s.isValid(ok.token)).toBe(true)
    expect(s.isValid('outro')).toBe(false)
    expect(s.isValid(null)).toBe(false)
  })

  it('a sessão expira em 12 horas', () => {
    const c = clock()
    const s = new AdminSessions('24681012', c.now)
    const ok = s.login('24681012', 'ip')
    if (!ok.ok) throw new Error('login falhou')
    c.advance(ADMIN_SESSION_TTL_MS - 1)
    expect(s.isValid(ok.token)).toBe(true)
    c.advance(1)
    expect(s.isValid(ok.token)).toBe(false)
  })

  it('sair revoga o token', () => {
    const s = new AdminSessions('24681012')
    const ok = s.login('24681012', 'ip')
    if (!ok.ok) throw new Error('login falhou')
    s.revoke(ok.token)
    expect(s.isValid(ok.token)).toBe(false)
  })

  it('5 erros seguidos bloqueiam o cliente por 1 minuto, até com o PIN certo; outros clientes seguem livres', () => {
    const c = clock()
    const s = new AdminSessions('24681012', c.now)
    for (let i = 1; i < MAX_FAILED_PIN_ATTEMPTS; i++) expect(s.login('00000000', 'a').ok).toBe(false)
    expect(s.login('00000000', 'a')).toEqual({ ok: false, reason: 'locked', retryAfterMs: PIN_LOCKOUT_MS })
    expect(s.login('24681012', 'a')).toMatchObject({ ok: false, reason: 'locked' })
    expect(s.login('24681012', 'b').ok).toBe(true)
    c.advance(PIN_LOCKOUT_MS)
    expect(s.login('24681012', 'a').ok).toBe(true)
  })

  it('acerto zera a contagem de erros', () => {
    const s = new AdminSessions('24681012')
    for (let i = 1; i < MAX_FAILED_PIN_ATTEMPTS; i++) s.login('00000000', 'a')
    expect(s.login('24681012', 'a').ok).toBe(true)
    expect(s.login('00000000', 'a')).toEqual({ ok: false, reason: 'invalid_pin' })
  })
})

describe('bearerToken', () => {
  it('lê o token do cabeçalho Authorization', () => {
    expect(bearerToken('Bearer abc')).toBe('abc')
    expect(bearerToken('bearer abc')).toBe('abc')
    expect(bearerToken('Basic abc')).toBeNull()
    expect(bearerToken(undefined)).toBeNull()
  })
})
