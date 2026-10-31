import { cn } from '@/lib/utils'

/** Selo "Amistoso" dos torneios que não pontuam em rankings. Oficial não mostra selo. */
export function KindBadge({ kind, className }: { kind?: string | null; className?: string }) {
  if (kind !== 'friendly') return null
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground',
        className,
      )}
    >
      Amistoso
    </span>
  )
}
