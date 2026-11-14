import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Sessões de admin por PIN, para a rede local. Com `ADMIN_PIN` definido, só quem digitou o PIN
// recebe um token (enviado em `Authorization: Bearer`) e o modo admin global deixa de existir.
// O token é assinado (HMAC), sem guardar sessão: reiniciar a API (deploy, hibernação do provedor) não derruba
// ninguém. A chave vem do PIN e de ADMIN_SESSION_SECRET, então trocar qualquer um dos dois revoga todas as sessões.
// Sair revoga o token só em memória (volta a valer se a API reiniciar antes de ele expirar).

// 8+: com o bloqueio por IP, mesmo vários aparelhos na rede levariam meses para testar 10^8 PINs numéricos.
export const ADMIN_PIN_MIN_LENGTH = 8
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
  private readonly signingKey: Buffer
  private readonly revoked = new Map<string, number>()
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>()

  constructor(pin: string, private readonly now: () => number = Date.now, secret = '') {
    this.pinDigest = digest(pin)
    this.signingKey = createHmac('sha256', `birdie-admin-session:${secret}`).update(pin).digest()
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.signingKey).update(`v1.${payload}`).digest('base64url')
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
      for (const [key, f] of this.failures) if (f.lockedUntil !== 0 && f.lockedUntil <= now) this.failures.delete(key)
      this.failures.set(clientKey, { count: locked ? 0 : count, lockedUntil: locked ? now + PIN_LOCKOUT_MS : 0 })
      return locked ? { ok: false, reason: 'locked', retryAfterMs: PIN_LOCKOUT_MS } : { ok: false, reason: 'invalid_pin' }
    }

    this.failures.delete(clientKey)
    // Formato v1.<prazo em base 36>.<nonce>.<assinatura>: o nonce deixa cada sessão única (sair revoga só a sua).
    const expiresAt = now + ADMIN_SESSION_TTL_MS
    const payload = `${expiresAt.toString(36)}.${randomBytes(9).toString('base64url')}`
    return { ok: true, token: `v1.${payload}.${this.sign(payload)}`, expiresAt: new Date(expiresAt) }
  }

  /** Prazo do token se a assinatura confere, ou null. Não olha a revogação. */
  private expiry(token: string | null): number | null {
    const match = /^v1\.(([0-9a-z]{1,12})\.[A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{43})$/.exec(token ?? '')
    const [, payload, stamp, signature] = match ?? []
    if (!payload || !stamp || !signature) return null
    const expected = Buffer.from(this.sign(payload))
    if (!timingSafeEqual(Buffer.from(signature), expected)) return null
    const expiresAt = parseInt(stamp, 36)
    const now = this.now()
    // Prazo além do TTL só sairia de uma chave vazada: recusa.
    return expiresAt > now && expiresAt <= now + ADMIN_SESSION_TTL_MS ? expiresAt : null
  }

  isValid(token: string | null): boolean {
    return this.expiry(token) !== null && !this.revoked.has(token as string)
  }

  revoke(token: string | null): void {
    const expiresAt = this.expiry(token)
    if (expiresAt === null) return
    const now = this.now()
    for (const [t, exp] of this.revoked) if (exp <= now) this.revoked.delete(t)
    this.revoked.set(token as string, expiresAt)
  }
}

/** Token de `Authorization: Bearer <token>`, ou `null`. */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return match?.[1] ?? null
}
