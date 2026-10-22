import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatTileProps {
  label: string
  value: ReactNode
  hint?: string
  /** Destaca o bloco (ex.: títulos) com o dourado de medalha. */
  highlight?: boolean
}

/** Deve ficar dentro de um `<dl>`. */
export function StatTile({ label, value, hint, highlight = false }: StatTileProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card px-4 py-3', highlight && 'border-medal-gold/60 bg-medal-gold/10')}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-heading text-3xl font-bold leading-none tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}
