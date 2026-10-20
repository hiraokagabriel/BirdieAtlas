import Link from 'next/link'
import { Calendar, MapPin } from 'lucide-react'
import type { TournamentSummary } from '@/lib/home-data'
import { formatDateRange } from '@/lib/format'
import { LevelBadge } from './level-badge'
import { StatusBadge } from './status-badge'

export function TournamentCard({ tournament: t }: { tournament: TournamentSummary }) {
  const place = [t.city, t.state].filter(Boolean).join(' / ')
  return (
    <Link
      href={`/t/${t.slug}`}
      className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status={t.status} />
        <LevelBadge level={t.level} />
      </div>
      <p className="font-heading text-xl font-semibold leading-tight">{t.name}</p>
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-4" aria-hidden="true" />
          {formatDateRange(t.startDate, t.endDate)}
        </span>
        {place && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {place}
          </span>
        )}
      </div>
    </Link>
  )
}
