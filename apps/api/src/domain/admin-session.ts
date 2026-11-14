import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// Sessões de admin por PIN, para a rede local. Com `ADMIN_PIN` definido, só quem digitou o PIN
// recebe um token (enviado em `Authorization: Bearer`) e o modo admin global deixa de existir.
// Tudo em memória: reiniciar a API derruba as sessões, e é o esperado.

export const ADMIN_PIN_MIN_LENGTH = 6
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000
export const MAX_FAILED_PIN_ATTEMPTS = 5
export const PIN_LOCKOUT_MS = 60 * 1000

/** PIN vazio ou ausente desliga o modo PIN. Curto demais é erro de configuração: a API não sobe. */
export function parseAdminPin(raw: string | undefined): string | null {
  const pin = raw?.trim() ?? ''
  if (pin === '') return null
  if (pin.length < ADMIN_PIN_MIN_LENGTH) {
    throw new Error(`ADMIN_PIN precisa de pelo menos ${ADMIN_PIN_MIN_LENGTH} caracteres.`)
  }
  return pin
}

const digest = (value: string) => createHash('sha256').update(value).digest()

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: 'invalid_pin' }
  | { ok: false; reason: 'locked'; retryAfterMs: number }

export class AdminSessions {
  private readonly pinDigest: Buffer
  private readonly sessions = new Map<string, number>()
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>()

  constructor(pin: string, private readonly now: () => number = Date.now) {
    this.pinDigest = digest(pin)
  }

  /** `clientKey` identifica quem tenta (o IP): 5 PINs errados seguidos bloqueiam esse cliente por 1 minuto. */
  login(pin: string, clientKey: string): LoginResult {
    const now = this.now()
    const failure = this.failures.get(clientKey)
    if (failure && failure.lockedUntil > now) return { ok: false, reason: 'locked', retryAfterMs: failure.lockedUntil - now }

    // Comparação em tempo constante sobre o hash, para não vazar o PIN pelo tempo de resposta.
    if (!timingSafeEqual(digest(pin), this.pinDigest)) {
      // Ao bloquear, a contagem volta a zero: depois do minuto, mais 5 tentativas.
      const count = (failure?.count ?? 0) + 1
      const locked = count >= MAX_FAILED_PIN_ATTEMPTS
      this.failures.set(clientKey, { count: locked ? 0 : count, lockedUntil: locked ? now + PIN_LOCKOUT_MS : 0 })
      return locked ? { ok: false, reason: 'locked', retryAfterMs: PIN_LOCKOUT_MS } : { ok: false, reason: 'invalid_pin' }
    }

    this.failures.delete(clientKey)
    for (const [token, expiresAt] of this.sessions) if (expiresAt <= now) this.sessions.delete(token)
    const token = randomBytes(32).toString('base64url')
    const expiresAt = now + ADMIN_SESSION_TTL_MS
    this.sessions.set(token, expiresAt)
    return { ok: true, token, expiresAt: new Date(expiresAt) }
  }

  isValid(token: string | null): boolean {
    if (!token) return false
    const expiresAt = this.sessions.get(token)
    if (expiresAt === undefined) return false
    if (expiresAt <= this.now()) {
      this.sessions.delete(token)
      return false
    }
    return true
  }

  revoke(token: string | null): void {
    if (token) this.sessions.delete(token)
  }
}

/** Token de `Authorization: Bearer <token>`, ou `null`. */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return match?.[1] ?? null
}
