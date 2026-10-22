'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { canTransitionTournament, type TournamentLevel, type TournamentStatus } from '@birdie-atlas/validators'
import { apiFetch } from '@/lib/api'
import { BracketView } from '@/components/bracket/bracket-view'
import { ScheduleView } from '@/components/bracket/schedule-view'
import { RegistrationsTab } from '@/components/tournament/registrations-tab'
import { FinalizeTournamentModal } from '@/components/tournament/finalize-tournament-modal'
import { TournamentSetupTab } from '@/components/tournament/tournament-setup-tab'
import { TournamentStatusActions } from '@/components/tournament/tournament-status-actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Calendar, MapPin, ExternalLink, ChevronLeft, Flag, RotateCcw, Settings } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Tournament = {
  id: string; name: string; slug: string; status: TournamentStatus; level: TournamentLevel
  startDate: string; endDate: string; city: string; state: string; location: string
  pointsAwarded: boolean; tenantId: string
}
type Category = { id: string; name: string; discipline: string; drawType: string; seedCount: number; maxEntries: number | null }

const statusMap: Record<string, { label: string; color: string }> = {
  draft:                { label: 'Rascunho',             color: 'bg-muted text-muted-foreground' },
  registration_open:   { label: 'Inscrições abertas',    color: 'bg-info/10 text-info' },
  registration_closed: { label: 'Inscrições encerradas', color: 'bg-warning/10 text-warning' },
  in_progress:         { label: 'Em andamento',          color: 'bg-success/10 text-success' },
  completed:           { label: 'Encerrado',             color: 'bg-muted text-muted-foreground' },
  cancelled:           { label: 'Cancelado',             color: 'bg-destructive/10 text-destructive' },
}

export default function TournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params)
  const router = useRouter()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'registrations' | 'bracket' | 'schedule' | 'setup'>('registrations')
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [reopening, setReopening] = useState(false)

  const fetchTournament = useCallback(() => {
    apiFetch<Tournament>(`/tournaments/${tournamentId}`)
      .then((t) => {
        setTournament(t)
        return apiFetch<Category[]>(`/tournaments/${t.id}/categories`)
      })
      .then(setCategories)
      .catch(() => router.push('/admin/tournaments'))
  }, [tournamentId, router])

  useEffect(() => { fetchTournament() }, [fetchTournament])

  async function handleReopen() {
    if (!tournament) return
    const msg = tournament.pointsAwarded
      ? 'Reabrir o campeonato irá REVERTER os pontos distribuídos nos rankings. Esta ação não pode ser desfeita. Confirmar?'
      : 'Reabrir o campeonato? O status voltará para "Em andamento".'
    if (!confirm(msg)) return
    setReopening(true)
    try {
      await apiFetch(`/tournaments/${tournament.id}/reopen`, { method: 'POST' })
      fetchTournament()
    } finally {
      setReopening(false)
    }
  }

  useDocumentTitle(tournament ? `${tournament.name} · Torneios · Administração` : 'Torneio · Administração')

  if (!tournament) return null

  const status      = statusMap[tournament.status] ?? { label: tournament.status, color: 'bg-muted text-muted-foreground' }
  const isCompleted = tournament.status === 'completed'

  const TABS = [
    { key: 'registrations', label: 'Inscrições' },
    { key: 'bracket',       label: 'Chaveamento' },
    { key: 'schedule',      label: 'Agenda' },
    { key: 'setup',         label: 'Configurações' },
  ] as const

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/admin/tournaments')}
        className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para Torneios
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{tournament.name}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>{status.label}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(tournament.startDate).toLocaleDateString('pt-BR')} — {new Date(tournament.endDate).toLocaleDateString('pt-BR')}
            </span>
            {tournament.city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {tournament.location && `${tournament.location}, `}{tournament.city}/{tournament.state}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <TournamentStatusActions tournamentId={tournament.id} status={tournament.status} onChanged={fetchTournament} />
          {isCompleted && (
            <button
              onClick={handleReopen}
              disabled={reopening}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {reopening ? 'Reabrindo...' : 'Reabrir campeonato'}
            </button>
          )}
          {canTransitionTournament(tournament.status, 'completed') && (
            <button
              onClick={() => setFinalizeOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors"
            >
              <Flag className="w-4 h-4" />
              Encerrar campeonato
            </button>
          )}
          <Link
            href={`/t/${tournament.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Página pública
            <span className="sr-only"> (abre em nova aba)</span>
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList aria-label="Seções do torneio">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.key === 'setup' && <Settings className="w-3.5 h-3.5" aria-hidden="true" />}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="registrations">
          <RegistrationsTab tournamentId={tournament.id} tournamentStatus={tournament.status} categories={categories} />
        </TabsContent>
        <TabsContent value="bracket">
          <BracketView tournamentId={tournament.id} categories={categories} pointsAwarded={tournament.pointsAwarded} />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleView tournamentId={tournament.id} categories={categories} defaultStartDate={tournament.startDate} />
        </TabsContent>
        <TabsContent value="setup">
          <TournamentSetupTab
            tournament={tournament}
            categories={categories}
            onRefresh={fetchTournament}
          />
        </TabsContent>
      </Tabs>

      <FinalizeTournamentModal
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        onFinalized={fetchTournament}
      />
    </div>
  )
}
