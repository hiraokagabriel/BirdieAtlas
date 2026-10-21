// Compartilhamento no navegador: Web Share API quando existe, cópia do link como alternativa.
// A lógica recebe o `navigator` por parâmetro para ser testável sem DOM.

export interface SharePayload {
  title: string
  text: string
  url: string
}

export interface ShareNavigator {
  share?: (data: SharePayload) => Promise<void>
  canShare?: (data: SharePayload) => boolean
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/**
 * - `shared`: o diálogo nativo concluiu o envio;
 * - `cancelled`: a pessoa fechou o diálogo (não é erro, não copia nada);
 * - `copied`: o link foi para a área de transferência;
 * - `failed`: nem compartilhar nem copiar funcionou.
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed'

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
}

export async function shareOrCopy(nav: ShareNavigator, payload: SharePayload): Promise<ShareOutcome> {
  if (typeof nav.share === 'function' && nav.canShare?.(payload) !== false) {
    try {
      await nav.share(payload)
      return 'shared'
    } catch (err) {
      if (isAbort(err)) return 'cancelled'
      // Qualquer outra falha do diálogo nativo cai na cópia do link.
    }
  }
  if (nav.clipboard) {
    try {
      await nav.clipboard.writeText(payload.url)
      return 'copied'
    } catch {
      return 'failed'
    }
  }
  return 'failed'
}

export const SHARE_MESSAGES: Record<ShareOutcome, string> = {
  shared: 'Compartilhado.',
  cancelled: '',
  copied: 'Link copiado para a área de transferência.',
  failed: 'Não foi possível copiar o link. Copie o endereço na barra do navegador.',
}

/** Endereço atual sem fragmento: é o que vai no compartilhamento. */
export function shareUrlFrom(href: string): string {
  const url = new URL(href)
  url.hash = ''
  return url.toString()
}
