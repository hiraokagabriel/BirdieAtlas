import { cn } from '@/lib/utils'

const MEDAL_STYLES: Record<number, string> = {
  1: 'bg-medal-gold text-medal-gold-foreground',
  2: 'bg-medal-silver text-medal-silver-foreground',
  3: 'bg-medal-bronze text-medal-bronze-foreground',
}

interface PlacementBadgeProps {
  /** Colocação final (1 = campeão) ou posição em ranking; `null` quando ainda não há resultado. */
  placement: number | null
  className?: string
}

/** Ouro, prata e bronze para 1º a 3º; neutro para o restante. */
export function PlacementBadge({ placement, className }: PlacementBadgeProps) {
  const label = placement === null ? 'Sem colocação' : `${placement}º lugar`
  const medal = placement === null ? undefined : MEDAL_STYLES[placement]
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full font-heading text-base font-bold tabular-nums',
        medal ?? 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <span aria-hidden="true">{placement === null ? '–' : `${placement}º`}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
