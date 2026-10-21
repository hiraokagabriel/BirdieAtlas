import { API_URL, ApiError } from '@/lib/api'
import { downloadErrorMessage, filenameFromDisposition } from '@/lib/download-helpers'

/** Baixa um arquivo da API (mesma origem de `apiFetch`) e dispara o download no navegador. */
export async function downloadFromApi(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' }).catch(() => {
    throw new ApiError(0, 'Não foi possível conectar à API. Verifique a conexão e tente novamente.', 'NETWORK_ERROR')
  })
  if (!res.ok) throw new ApiError(res.status, await downloadErrorMessage(res))

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
