import { API_URL } from './env.js'

/** Erro de uma chamada à API de teste, já no formato `{ error, code?, details? }` do contrato. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly body: unknown

  constructor(method: string, path: string, status: number, body: unknown) {
    const message = isErrorBody(body) ? body.error : JSON.stringify(body)
    super(`${method} ${path} respondeu ${status}: ${message}`)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = isErrorBody(body) ? body.code : undefined
    this.body = body
  }
}

function isErrorBody(value: unknown): value is { error: string; code?: string } {
  return typeof value === 'object' && value !== null && typeof (value as { error?: unknown }).error === 'string'
}

export interface ApiResult<T> {
  status: number
  ok: boolean
  body: T
}

/** Chamada crua: devolve status e corpo sem lançar, para testes que verificam erros. */
export async function apiCall<T = unknown>(method: string, path: string, json?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    ...(json !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) } : {}),
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // Corpo que não é JSON (ex.: CSV): devolve o texto.
  }
  return { status: res.status, ok: res.ok, body: body as T }
}

async function expectOk<T>(method: string, path: string, json?: unknown): Promise<T> {
  const result = await apiCall<T>(method, path, json)
  if (!result.ok) throw new ApiRequestError(method, path, result.status, result.body)
  return result.body
}

/** Cliente fino da API de teste. Lança `ApiRequestError` em qualquer resposta que não seja 2xx. */
export const api = {
  get: <T>(path: string) => expectOk<T>('GET', path),
  post: <T>(path: string, json?: unknown) => expectOk<T>('POST', path, json),
  put: <T>(path: string, json?: unknown) => expectOk<T>('PUT', path, json),
  patch: <T>(path: string, json?: unknown) => expectOk<T>('PATCH', path, json),
  delete: (path: string) => expectOk<null>('DELETE', path),
}

export async function setAdminMode(enabled: boolean): Promise<void> {
  await api.patch('/dev/admin-mode', { enabled })
}
