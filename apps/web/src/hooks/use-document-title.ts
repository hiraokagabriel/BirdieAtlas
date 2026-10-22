'use client'

import { useEffect } from 'react'

export const SITE_NAME = 'BirdieAtlas'

/**
 * Título da aba para páginas de cliente, que não podem exportar `metadata` (WCAG 2.4.2). Páginas de servidor
 * usam `metadata` do Next. O anunciador de rotas do Next lê `document.title` nas navegações do lado do cliente.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${SITE_NAME}`
  }, [title])
}
