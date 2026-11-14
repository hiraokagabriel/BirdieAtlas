import { ADMIN_PIN_MIN_LENGTH } from './admin-session.js'

/** Na internet o PIN enfrenta tentativas de muitos IPs: em produção ele precisa ser longo. */
export const PRODUCTION_ADMIN_PIN_MIN_LENGTH = 16
/** Segredo que assina os tokens de admin: com ele vazado, dá para forjar sessão, então é longo e aleatório. */
export const ADMIN_SESSION_SECRET_MIN_LENGTH = 32

export interface ServerConfig {
  production: boolean
  /** Número de saltos de proxy confiáveis (0 = IP do socket). Nunca `true`: o cliente forjaria o IP. */
  trustProxy: number
  /** `true` reflete qualquer origem (desenvolvimento e E2E); em produção, só a lista de CORS_ORIGINS. */
  corsOrigin: true | (string | RegExp)[]
}

type Env = Record<string, string | undefined>

/** `https://*.vercel.app` vira regex de um subdomínio; o resto é comparado exatamente. */
function originMatcher(entry: string): string | RegExp {
  if (!entry.includes('*')) return entry
  const escaped = entry.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('[a-z0-9-]+')}$`, 'i')
}

/**
 * Lê e valida a configuração de rede e segurança da API. Em produção (`NODE_ENV=production`) a API não sobe
 * com o modo admin global ligado, sem PIN longo ou sem lista de origens: cada erro vira uma linha da mensagem.
 */
export function readServerConfig(env: Env): ServerConfig {
  const production = env['NODE_ENV'] === 'production'
  const problems: string[] = []

  const rawProxy = (env['TRUST_PROXY'] ?? '').trim()
  const trustProxy = rawProxy === '' ? 0 : Number(rawProxy)
  if (!Number.isInteger(trustProxy) || trustProxy < 0) problems.push('TRUST_PROXY deve ser um inteiro >= 0 (número de proxies na frente da API).')

  const origins = (env['CORS_ORIGINS'] ?? '').split(',').map((o) => o.trim()).filter(Boolean)

  if (production) {
    if (env['DEV_ADMIN_MODE'] === 'true') problems.push('DEV_ADMIN_MODE=true é proibido em produção.')
    const pin = (env['ADMIN_PIN'] ?? '').trim()
    if (pin.length < PRODUCTION_ADMIN_PIN_MIN_LENGTH) {
      problems.push(`ADMIN_PIN é obrigatório em produção, com pelo menos ${PRODUCTION_ADMIN_PIN_MIN_LENGTH} caracteres (o mínimo na rede local é ${ADMIN_PIN_MIN_LENGTH}).`)
    }
    if ((env['ADMIN_SESSION_SECRET'] ?? '').trim().length < ADMIN_SESSION_SECRET_MIN_LENGTH) {
      problems.push(`ADMIN_SESSION_SECRET é obrigatório em produção, com pelo menos ${ADMIN_SESSION_SECRET_MIN_LENGTH} caracteres aleatórios (assina as sessões de admin).`)
    }
    if (origins.length === 0) problems.push('CORS_ORIGINS é obrigatório em produção (origens do site, separadas por vírgula).')
    // Sem declarar, atrás de um proxy todo mundo teria o IP do proxy: um balde só no rate limit e no bloqueio de PIN.
    if (rawProxy === '') problems.push('TRUST_PROXY é obrigatório em produção (0 se a API recebe a conexão direto).')
  }

  if (problems.length > 0) throw new Error(`Configuração inválida da API:\n- ${problems.join('\n- ')}`)
  return { production, trustProxy, corsOrigin: production ? origins.map(originMatcher) : true }
}
