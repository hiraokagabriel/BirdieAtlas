import type { ReactNode } from 'react'
import { DISCIPLINE_PILL, disciplineShort } from '@/lib/discipline'
import type { LiveMatch } from '@/lib/live'
import { cn } from '@/lib/utils'

/**
 * Linha de partida (docs/DESIGN.md, assinatura): quadra à esquerda em Barlow Condensed, os dois lados um
 * embaixo do outro e os sets à direita, com o set em andamento em verde. Puramente visual (`aria-hidden`):
 * quem usa dá o resumo acessível (texto `sr-only` ou `aria-label` do contêiner).
 */
export function LiveScoreGrid({ match: m, caption }: { match: LiveMatch; caption?: ReactNode }) {
  // Sets fechados e o set em andamento, na ordem.
  const sets = [...m.sets.map((s) => [s.score1, s.score2] as const), ...(m.currentSet ? [[m.currentSet.score1, m.currentSet.score2] as const] : [])]
  const current = m.currentSet ? sets.length - 1 : -1
  const leader = m.setsWon.side1 === m.setsWon.side2 ? 0 : m.setsWon.side1 > m.setsWon.side2 ? 1 : 2
  return (
    <div aria-hidden="true" className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-x-3 gap-y-1">
      <span
        className={cn(
          'self-start font-heading text-xs font-bold uppercase leading-tight tracking-wide text-muted-foreground',
          caption ? 'row-span-3' : 'row-span-2',
        )}
      >
        {m.courtNumber ? (
          <>
            Quadra
            <span className="block text-[1.75rem] leading-none tracking-normal text-foreground tabular-nums">{m.courtNumber}</span>
          </>
        ) : (
          <span className={cn('inline-flex rounded-sm px-1.5 py-0.5 tracking-normal', DISCIPLINE_PILL[m.discipline])}>{disciplineShort(m.discipline)}</span>
        )}
      </span>
      {caption && <span className="col-span-2 min-w-0 text-xs text-muted-foreground">{caption}</span>}
      {([1, 2] as const).map((side) => (
        <div key={side} className="contents">
          <span className={cn('min-w-0 break-words leading-snug', leader === side ? 'font-semibold' : leader === 0 ? undefined : 'text-muted-foreground')}>
            {(side === 1 ? m.participant1 : m.participant2) ?? 'A definir'}
          </span>
          <span className="flex justify-end gap-2.5 font-heading text-xl font-bold tabular-nums">
            {sets.map((s, i) => (
              <span key={i} className={i === current ? 'text-primary' : undefined}>
                {side === 1 ? s[0] : s[1]}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
