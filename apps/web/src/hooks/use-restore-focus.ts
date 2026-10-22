'use client'

import { useCallback, useRef } from 'react'

/**
 * Devolve o foco a quem abriu o diálogo/painel quando ele fecha (WCAG 2.4.3). O Radix só faz isso com um
 * `Trigger`; aqui os overlays abrem por estado (botão que chama `setOpen(true)`), então o foco iria para o <body>.
 * Guarda o elemento focado quando o overlay abre e o refocaliza ao fechar, se ele ainda estiver na página.
 */
export function useRestoreFocus() {
  const opener = useRef<HTMLElement | null>(null)

  const onOpenAutoFocus = useCallback(() => {
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
  }, [])

  const onCloseAutoFocus = useCallback((event: Event) => {
    const target = opener.current
    opener.current = null
    if (target?.isConnected) {
      event.preventDefault()
      target.focus()
    }
  }, [])

  return { onOpenAutoFocus, onCloseAutoFocus }
}
