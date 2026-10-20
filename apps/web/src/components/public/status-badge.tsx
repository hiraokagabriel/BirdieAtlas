import { TOURNAMENT_STATUSES, TOURNAMENT_STATUS_LABELS, type TournamentStatus } from '@birdie-atlas/validators'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<TournamentStatus, { text: string; dot: string }> = {
  draft: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  registration_open: { text: 'text-info', dot: 'bg-info' },
  registration_closed: { text: 'text-warning', dot: 'bg-warning' },
  in_progress: { text: 'text-success', dot: 'bg-success' },
  completed: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  cancelled: { text: 'text-destructive', dot: 'bg-destructive' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const known = TOURNAMENT_STATUSES.find((s) => s === status)
  const style = known ? STATUS_STYLES[known] : STATUS_STYLES.draft
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', style.text, className)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', style.dot)} />
      {known ? TOURNAMENT_STATUS_LABELS[known] : status}
    </span>
  )
}
