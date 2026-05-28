const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  /** Automatically serializes the value as JSON and sets Content-Type header. */
  json?: unknown
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
    throw new Error(
      `Network error on ${path}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error: ${res.status}${text ? ` — ${text}` : ''}`)
  }

  return res.json() as Promise<T>
}
