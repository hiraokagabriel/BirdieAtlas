import type { Metadata } from 'next'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { PagerLinks } from '@/components/shared/pager-links'
import { KindBadge } from '@/components/shared/kind-badge'
import { LevelBadge } from '@/components/public/level-badge'
import { StatusBadge } from '@/components/public/status-badge'
import { EmptyNotice } from '@/components/public/notices'
import { ROWS, ROW_LINK } from '@/components/public/rows'
import { formatDateRange } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CreateTournamentDialog } from '@/components/tournament/create-tournament-dialog'
import { ImportTournamentDialog } from '@/components/tournament/import-tournament-dialog'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

type Tournament = {
  id: string
  name: string
  slug: string
  status: string
  level: string
  kind?: string
  startDate: string
  endDate: string
  city: string
  state: string
  location: string
}

export const metadata: Metadata = { title: 'Torneios · Administração · BirdieAtlas' }

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page = '1' } = await searchParams
  const { data: tournaments, pagination } = await apiFetch<Paginated<Tournament>>(
    `/tournaments?page=${encodeURIComponent(page)}&pageSize=60`,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl">Torneios</h2>
          <p className="text-sm text-muted-foreground">Gerencie todos os campeonatos da federação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportTournamentDialog />
          <CreateTournamentDialog />
        </div>
      </div>

      {tournaments.length === 0 ? (
        <EmptyNotice>Nenhum torneio cadastrado ainda. Crie o primeiro em “Novo torneio” ou importe uma planilha.</EmptyNotice>
      ) : (
        <ul className={ROWS}>
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/tournaments/${t.id}`} className={cn('flex min-h-14 items-center gap-3 px-4 py-2.5', ROW_LINK)}>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words font-semibold leading-snug">{t.name}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge status={t.status} />
                    <LevelBadge level={t.level} className="bg-muted text-muted-foreground" />
                    <KindBadge kind={t.kind} />
                    <span className="tabular-nums">{formatDateRange(t.startDate, t.endDate)}</span>
                    {t.city && <span>{t.location ? `${t.location}, ` : ''}{t.city}/{t.state}</span>}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <PagerLinks pagination={pagination} basePath="/admin/tournaments" />
    </div>
  )
}
