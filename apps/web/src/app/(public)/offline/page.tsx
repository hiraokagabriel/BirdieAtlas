import type { Metadata } from 'next'
import { WifiOff } from 'lucide-react'

export const metadata: Metadata = { title: 'Sem conexão · BirdieAtlas' }

// Mostrada pelo service worker quando uma navegação falha por falta de rede.
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <WifiOff className="size-12 text-muted-foreground/40" aria-hidden="true" />
      <h1 className="text-2xl">Sem conexão</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Não foi possível falar com o servidor. Confira a rede e tente de novo: placares, chaves e rankings
        precisam de conexão para estar sempre atualizados.
      </p>
    </div>
  )
}
