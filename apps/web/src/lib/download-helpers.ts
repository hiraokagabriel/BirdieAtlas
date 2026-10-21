// Partes puras do download de arquivos da API (testáveis sem DOM).

/**
 * Nome do arquivo a partir de `Content-Disposition`. Prefere `filename*` (RFC 5987, UTF-8) e cai em
 * `filename`. Remove separadores de caminho: o nome vem do servidor, mas só o nome do arquivo é usado.
 */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1]
  let name: string | undefined
  if (extended) {
    try {
      name = decodeURIComponent(extended.trim())
    } catch {
      name = undefined
    }
  }
  name ??= /filename\s*=\s*"([^"]+)"/i.exec(header)?.[1] ?? /filename\s*=\s*([^;]+)/i.exec(header)?.[1]?.trim()
  const clean = name?.replace(/[\\/]/g, '_').replace(/[\r\n]/g, '')
  return clean ? clean : fallback
}

/** Mensagem de erro para o usuário a partir da resposta HTTP de um download que falhou. */
export async function downloadErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const body: unknown = text ? JSON.parse(text) : undefined
    if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error
    }
  } catch {
    // corpo que não é JSON: usa a mensagem padrão abaixo
  }
  return `Não foi possível baixar o arquivo (erro ${res.status}).`
}
