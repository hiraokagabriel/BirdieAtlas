import type { Metadata } from 'next'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { PagerLinks } from '@/components/shared/pager-links'
import { Badge } from '@/components/ui/badge'
import { KindBadge } from '@/components/shared/kind-badge'
import { CreateTournamentDialog } from '@/components/tournament/create-tournament-dialog'
import { ImportTournamentDialog } from '@/components/tournament/import-tournament-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, MapPin, Trophy } from 'lucide-react'
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

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  registration_open: { label: 'Inscrições abertas', className: 'bg-info/10 text-info' },
  registration_closed: { label: 'Inscrições encerradas', className: 'bg-warning/10 text-warning' },
  in_progress: { label: 'Em andamento', className: 'bg-success/10 text-success' },
  completed: { label: 'Encerrado', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive' },
}

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page = '1' } = await searchParams
  const { data: tournaments, pagination } = await apiFetch<Paginated<Tournament>>(
    `/tournaments?page=${encodeURIComponent(page)}&pageSize=60`,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Torneios</h2>
          <p className="text-muted-foreground">Gerencie todos os campeonatos da federação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportTournamentDialog />
          <CreateTournamentDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tournaments.map((t) => {
          const status = statusConfig[t.status] ?? { label: t.status, className: 'bg-muted text-muted-foreground' }
          return (
            <Link key={t.id} href={`/admin/tournaments/${t.id}`}>
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Trophy className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.level}</span>
                    </div>
                    <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base leading-tight">{t.name}</h3>
                    <KindBadge kind={t.kind} className="mt-1.5" />
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(t.startDate).toLocaleDateString('pt-BR')} — {new Date(t.endDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {t.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{t.location ? `${t.location}, ` : ''}{t.city}/{t.state}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <PagerLinks pagination={pagination} basePath="/admin/tournaments" />
    </div>
  )
}
