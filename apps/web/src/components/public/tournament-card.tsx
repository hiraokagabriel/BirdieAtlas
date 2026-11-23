import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { TournamentSummary } from '@/lib/home-data'
import { formatDateRange } from '@/lib/format'
import { LevelBadge } from './level-badge'
import { StatusBadge } from './status-badge'
import { KindBadge } from '@/components/shared/kind-badge'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Linha de torneio (docs/DESIGN.md: listas com divisórias no lugar de grade de cartões). Vai dentro de `<ul>` com `divide-y`. */
export function TournamentRow({ tournament: t }: { tournament: TournamentSummary }) {
  const place = [t.city, t.state].filter(Boolean).join(' / ')
  // startDate é "AAAA-MM-DD": lido como texto para não deslocar o dia pelo fuso.
  const [, month, day] = t.startDate.slice(0, 10).split('-')
  return (
    <Link
      href={`/t/${t.slug}`}
      className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-offset-[-2px]"
    >
      <span aria-hidden="true" className="w-12 shrink-0 text-center leading-none">
        <span className="block font-heading text-[1.625rem] font-bold tabular-nums">{day}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{MONTHS[Number(month) - 1]}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-[1.0625rem]">{t.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <StatusBadge status={t.status} />
          <KindBadge kind={(t as { kind?: string }).kind} />
          <span>{formatDateRange(t.startDate, t.endDate)}</span>
          {place && <span>{place}</span>}
        </span>
      </span>
      <LevelBadge level={t.level} className="bg-muted text-muted-foreground" />
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
