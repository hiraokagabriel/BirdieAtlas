import type { ReactNode } from 'react'

/**
 * Faixa de números (template `atleta`): uma superfície só, com divisórias de 1 px entre as células, em vez
 * de uma grade de cartões. Com quantidade ímpar, a última célula ocupa a linha inteira no celular.
 */
export const STAT_GRID =
  'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border [&>*:last-child:nth-child(odd)]:col-span-2 md:auto-cols-fr md:grid-flow-col md:grid-cols-none md:[&>*:last-child:nth-child(odd)]:col-span-1'

interface StatTileProps {
  label: string
  value: ReactNode
  hint?: string
  /** Âncora da seção que detalha o número (ex.: `#history-title`): o bloco inteiro vira o alvo do link. */
  href?: string
  /** Nome do link para leitor de tela (ex.: "Ver o histórico de torneios"). */
  linkLabel?: string
}

/** Célula de `STAT_GRID`; deve ficar dentro de um `<dl>`. */
export function StatTile({ label, value, hint, href, linkLabel }: StatTileProps) {
  return (
    <div className={href ? 'relative bg-card px-4 py-3 transition-colors hover:bg-muted/60' : 'bg-card px-4 py-3'}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-heading text-3xl font-bold leading-none tabular-nums">
        {value}
        {/* Link esticado sobre o bloco (posicionado pelo div): o alvo de toque é a célula inteira e o texto não muda. */}
        {href && <a href={href} className="absolute inset-0 rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" aria-label={linkLabel ?? label} />}
      </dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}
