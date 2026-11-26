'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { CONTRACT_MISMATCH_EVENT } from '@/lib/contract'
import { Button } from '@/components/ui/button'

/**
 * Aviso de versões diferentes entre o site e a API (deploy fora de ordem): em vez de partes da tela sumirem em
 * silêncio, pede para recarregar daqui a pouco. Aparece uma vez por carga de página.
 */
export function ContractBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const on = () => setShow(true)
    window.addEventListener(CONTRACT_MISMATCH_EVENT, on)
    return () => window.removeEventListener(CONTRACT_MISMATCH_EVENT, on)
  }, [])
  if (!show) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-3 shadow-lg print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm">
        <p>O BirdieAtlas está sendo atualizado. Se algo parecer estranho, recarregue a página em alguns minutos.</p>
        <span className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setShow(false)}>Fechar</Button>
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Recarregar
          </Button>
        </span>
      </div>
    </div>
  )
}
