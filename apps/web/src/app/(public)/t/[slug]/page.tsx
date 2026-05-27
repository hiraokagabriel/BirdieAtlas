'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { BracketDraw } from '@/components/bracket/bracket-draw'
import { ScheduleView } from '@/components/bracket/schedule-view'
import { Calendar, MapPin, Trophy } from 'lucide-react'

type Tournament = {
  id: string; name: string; slug: string; status: string; level: string
  startDate: string; endDate: string; city: string; state: string; location: string
}
type Category = { id: string; name: string; discipline: string; drawType: string; seedCount: number }
type Draw = { id: string; published: boolean }
type Match = {
  id: string; round: number; position: number; status: string
  registration1Id: string | null; registration2Id: string | null
  nextMatchId: string | null; scheduledAt: string | null; courtNumber: number | null
}
type Registration = { id: string; athleteId: string; athlete2Id: string | null; seed: number | null; rankingPointsAtEntry: number | null }
type MatchResult = { matchId: string; setNumber: number; score1: number; score2: number }
type Athlete = { id: string; name: string }

const statusMap: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Rascunho', color: 'text-gray-500', dot: 'bg-gray-300' },
  registration_open: { label: 'Inscrições abertas', color: 'text-blue-600', dot: 'bg-blue-400' },
  registration_closed: { label: 'Inscrições encerradas', color: 'text-yellow-600', dot: 'bg-yellow-400' },
  in_progress: { label: 'Em andamento', color: 'text-green-600', dot: 'bg-green-500 animate-pulse' },
  completed: { label: 'Encerrado', color: 'text-gray-500', dot: 'bg-gray-300' },
}

export default function PublicTournamentPage({ params }: { params: { slug: string } }) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'bracket' | 'schedule'>('bracket')

  // Bracket da categoria ativa
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [draw, setDraw] = useState<Draw | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [results, setResults] = useState<MatchResult[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])

  useEffect(() => {
    apiFetch<Tournament[]>('/tournaments').then((list) => {
      const t = list.find((t) => t.slug === params.slug)
      if (!t) return
      setTournament(t)
      apiFetch<Category[]>(`/tournaments/${t.id}/categories`).then((cats) => {
        setCategories(cats)
        if (cats.length) setActiveCategoryId(cats[0].id)
      })
    })
  }, [params.slug])

  useEffect(() => {
    if (!activeCategoryId) return
    Promise.all([
      apiFetch<Draw[]>(`/tournaments/categories/${activeCategoryId}/draws`),
      apiFetch<Registration[]>(`/tournaments/categories/${activeCategoryId}/registrations`),
    ]).then(async ([drawList, regs]) => {
      setRegistrations(regs)
      if (!drawList.length) { setDraw(null); setMatches([]); return }
      const d = drawList[0]
      setDraw(d)
      const matchList = await apiFetch<Match[]>(`/draws/${d.id}/matches`)
      setMatches(matchList)
      const allResults = await Promise.all(matchList.map((m) => apiFetch<MatchResult[]>(`/draws/matches/${m.id}/result`)))
      setResults(allResults.flat())
    })
  }, [activeCategoryId])

  useEffect(() => {
    if (!registrations.length) return
    apiFetch<Athlete[]>('/athletes').then(setAthletes)
  }, [registrations])

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando...
      </div>
    )
  }

  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const status = statusMap[tournament.status] ?? statusMap.draft

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tournament.level}</p>
            <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {new Date(tournament.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' — '}
            {new Date(tournament.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
          {tournament.city && (
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {tournament.location && `${tournament.location} · `}{tournament.city}, {tournament.state}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['bracket', 'schedule'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'bracket' ? '🏆 Chaveamento' : '📅 Agenda'}
          </button>
        ))}
      </div>

      {/* Bracket público (sem edição) */}
      {tab === 'bracket' && (
        <div className="space-y-4">
          {/* Seletor de categoria */}
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  cat.id === activeCategoryId
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-auto">
            {!draw ? (
              <div className="p-12 text-center text-muted-foreground">
                <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Chaveamento não disponível</p>
                <p className="text-sm mt-1">O chaveamento desta categoria ainda não foi gerado.</p>
              </div>
            ) : (
              <BracketDraw
                matches={matches}
                registrations={registrations}
                athletes={athletes}
                results={results}
                activeCategory={activeCategory}
                drawId={draw.id}
                readonly
              />
            )}
          </div>
        </div>
      )}

      {/* Agenda pública (sem edição) */}
      {tab === 'schedule' && (
        <ScheduleView tournamentId={tournament.id} categories={categories} readonly />
      )}
    </div>
  )
}
