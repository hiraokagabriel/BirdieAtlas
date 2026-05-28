'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { BracketView } from '@/components/bracket/bracket-view'
import { ScheduleView } from '@/components/bracket/schedule-view'
import { RegistrationsTab } from '@/components/tournament/registrations-tab'
import { FinalizeTournamentModal } from '@/components/tournament/finalize-tournament-modal'
import { Calendar, MapPin, ExternalLink, ChevronLeft, Flag } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Tournament = {
  id: string; name: string; slug: string; status: string; level: string
  startDate: string; endDate: string; city: string; state: string; location: string
  pointsAwarded: boolean
}
type Category = { id: string; name: string; discipline: string; drawType: string; seedCount: number }

const statusMap: Record<string, { label: string; color: string }> = {
  draft:                { label: 'Rascunho',               color: 'bg-gray-100 text-gray-700' },
  registration_open:   { label: 'Inscrições abertas',      color: 'bg-blue-100 text-blue-700' },
  registration_closed: { label: 'Inscrições encerradas',   color: 'bg-yellow-100 text-yellow-700' },
  in_progress:         { label: 'Em andamento',            color: 'bg-green-100 text-green-700' },
  finished:            { label: 'Encerrado',               color: 'bg-gray-100 text-gray-500' },
  completed:           { label: 'Concluído',               color: 'bg-gray-100 text-gray-600' },
}

export default function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'registrations' | 'bracket' | 'schedule'>('registrations')
  const [finalizeOpen, setFinalizeOpen] = useState(false)

  function fetchTournament() {
    apiFetch<Tournament>(`/tournaments/by-slug/${slug}`)
      .then((t) => {
        setTournament(t)
        return apiFetch<Category[]>(`/tournaments/${t.id}/categories`)
      })
      .then(setCategories)
      .catch(() => router.push('/tournaments'))
  }

  useEffect(() => { fetchTournament() }, [slug])

  if (!tournament) return null

  const status = statusMap[tournament.status] ?? { label: tournament.status, color: 'bg-gray-100 text-gray-700' }
  const isFinished = tournament.status === 'finished'

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/tournaments')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para Torneios
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
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

        <div className="flex items-center gap-2 shrink-0">
          {!isFinished && (
            <button
              onClick={() => setFinalizeOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              <Flag className="w-4 h-4" />
              Encerrar campeonato
            </button>
          )}
          <Link
            href={`/t/${tournament.slug}`}
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Página pública
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['registrations', 'bracket', 'schedule'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'registrations' ? 'Inscrições' : t === 'bracket' ? 'Chaveamento' : 'Agenda'}
          </button>
        ))}
      </div>

      {tab === 'registrations' && <RegistrationsTab tournamentId={tournament.id} categories={categories} />}
      {tab === 'bracket' && <BracketView tournamentId={tournament.id} categories={categories} pointsAwarded={tournament.pointsAwarded} />}
      {tab === 'schedule' && <ScheduleView tournamentId={tournament.id} categories={categories} />}

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
