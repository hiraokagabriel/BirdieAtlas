// Token da sessão de admin por PIN (API com ADMIN_PIN), guardado neste navegador.
// Sem PIN na API, nunca há token e nada muda. localStorage pode faltar (aba privada, bloqueio): sem ele, só não há sessão.

const STORAGE_KEY = 'birdie_admin_token'

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sem armazenamento não dá para guardar a sessão: o admin continua sem token e vê o 403 normal.
  }
}

/** Cabeçalho `Authorization` para chamadas à API, quando há sessão de admin neste navegador. */
export function adminAuthHeaders(): Record<string, string> {
  const token = getAdminToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
