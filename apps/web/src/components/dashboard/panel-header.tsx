import type { ReactNode } from 'react'

/** Cabeçalho de painel do admin: 48 px, título à esquerda e ação ou contexto à direita, separado por linha (docs/DESIGN.md). */
export function PanelHeader({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2">
      <h3 id={id} className="text-lg">{title}</h3>
      {children}
    </div>
  )
}
