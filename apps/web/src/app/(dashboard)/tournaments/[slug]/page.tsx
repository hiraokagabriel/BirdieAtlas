'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { BracketView } from '@/components/bracket/bracket-view'
import { ScheduleView } from '@/components/bracket/schedule-view'
import { Calendar, MapPin, ExternalLink, Trophy, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Tournament = {
  id: string; name: string; slug: string; status: string; level: string
  startDate: string; endDate: string; city: string; state: string; location: string
  pointsAwarded: boolean
}
type Category = { id: string; name: string; discipline: string; drawType: string; seedCount: number }

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  registration_open: { label: 'Inscrições abertas', color: 'bg-blue-100 text-blue-700' },
  registration_closed: { label: 'Inscrições encerradas', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Em andamento', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Encerrado', color: 'bg-gray-100 text-gray-600' },
}

export default function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'bracket' | 'schedule'>('bracket')
  const [awarding, setAwarding] = useState(false)

  useEffect(() => {
    apiFetch<Tournament[]>('/tournaments').then((list) => {
      const t = list.find((t) => t.slug === slug)
      if (!t) return
      setTournament(t)
      apiFetch<Category[]>(`/tournaments/${t.id}/categories`).then(setCategories)
    })
  }, [slug])

  async function handleAwardPoints() {
    if (!tournament) return
    setAwarding(true)
    try {
      await apiFetch(`/tournaments/${tournament.id}/award-points`, { method: 'POST' })
      setTournament((prev) => prev ? { ...prev, pointsAwarded: true } : prev)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao distribuir pontos'
      alert(message)
    } finally {
      setAwarding(false)
    }
  }

  if (!tournament) return null

  const status = statusMap[tournament.status] ?? { label: tournament.status, color: 'bg-gray-100 text-gray-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{tournament.name}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>{status.label}</span>
            {tournament.pointsAwarded && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3" /> Pontos distribuídos
              </span>
            )}
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

        <div className="flex items-center gap-3 shrink-0">
          {!tournament.pointsAwarded ? (
            <button
              onClick={handleAwardPoints}
              disabled={awarding}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trophy className="w-4 h-4" />
              {awarding ? 'Distribuindo...' : 'Distribuir Pontos'}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Pontos já distribuídos
            </span>
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
      <div className="flex border-b border-border gap-0">
        {(['bracket', 'schedule'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'bracket' ? 'Chaveamento' : 'Agenda'}
          </button>
        ))}
      </div>

      {tab === 'bracket' && <BracketView tournamentId={tournament.id} categories={categories} />}
      {tab === 'schedule' && <ScheduleView tournamentId={tournament.id} categories={categories} />}
    </div>
  )
}
