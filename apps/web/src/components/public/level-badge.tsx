import { TOURNAMENT_LEVELS, TOURNAMENT_LEVEL_LABELS, type TournamentLevel } from '@birdie-atlas/validators'
import { cn } from '@/lib/utils'

const LEVEL_STYLES: Record<TournamentLevel, string> = {
  local: 'bg-level-local text-level-local-foreground',
  regional: 'bg-level-regional text-level-regional-foreground',
  state: 'bg-level-state text-level-state-foreground',
  national: 'bg-level-national text-level-national-foreground',
  international: 'bg-level-international text-level-international-foreground',
}

export function LevelBadge({ level, className }: { level: string; className?: string }) {
  if (!level) return null
  const known = TOURNAMENT_LEVELS.find((l) => l === level)
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        known ? LEVEL_STYLES[known] : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {known ? TOURNAMENT_LEVEL_LABELS[known] : level}
    </span>
  )
}
