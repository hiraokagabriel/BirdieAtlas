import type { ApiErrorBody } from '@birdie-atlas/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  /** Automatically serializes the value as JSON and sets Content-Type header. */
  json?: unknown
}

/** Erro lançado por `apiFetch`, já interpretado a partir do contrato `{ error, code, details }`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly details: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && typeof (value as ApiErrorBody).error === 'string'
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '')
  let body: unknown = undefined
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    // Corpo não-JSON (ex.: proxy ou HTML de erro): usa o texto cru como mensagem.
  }

  if (isApiErrorBody(body)) {
    return new ApiError(res.status, body.error, body.code, body.details)
  }

  return new ApiError(res.status, text || `Erro ${res.status} na API.`)
}

export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const { json, headers, ...rest } = options ?? {}

  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...rest,
    ...(json !== undefined && {
      body: JSON.stringify(json),
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }),
    ...(json === undefined && headers ? { headers } : {}),
  }).catch((err: unknown) => {
    throw new ApiError(
      0,
      `Não foi possível conectar à API (${path}): ${err instanceof Error ? err.message : String(err)}`,
      'NETWORK_ERROR',
    )
  })

  if (!res.ok) {
    throw await toApiError(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}
