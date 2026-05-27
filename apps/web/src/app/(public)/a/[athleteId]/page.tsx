'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { MapPin, Calendar, Building2, Trophy, ChevronRight, Medal } from 'lucide-react'
import Link from 'next/link'

type Athlete = {
  id: string; name: string; gender: string
  birthDate: string | null; nationality: string; photoUrl: string | null; active: boolean
}
type Club = { clubId: string; clubName: string; clubSlug: string; city: string | null; state: string | null; startedAt: string }
type RankingPosition = {
  rankingId: string; rankingName: string; discipline: string; year: number
  position: number; points: number; partnerId: string | null; partnerName: string | null
}
type TournamentEntry = {
  registrationId: string; seed: number | null; withdrew: boolean
  categoryName: string; discipline: string
  tournamentId: string; tournamentName: string; tournamentSlug: string
  tournamentStatus: string; startDate: string; endDate: string; level: string
  city: string; state: string; rankingPointsAtEntry: number | null
}
type TournamentResult = {
  tournamentName: string; tournamentSlug: string
  categoryName: string; discipline: string
  placement: number; points: number
  startDate: string
  partnerName: string | null
}
type Profile = {
  athlete: Athlete
  currentClub: Club | null
  rankingPositions: RankingPosition[]
  tournamentHistory: TournamentEntry[]
  recentResults?: TournamentResult[]
}

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Duplas Misto',
}
const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-700 border-blue-200',
  WS: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MD: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-500/10 text-pink-700 border-pink-200',
  XD: 'bg-orange-500/10 text-orange-700 border-orange-200',
}
const statusLabel: Record<string, { label: string; color: string }> = {
  draft:               { label: 'Rascunho',              color: 'text-gray-400' },
  registration_open:   { label: 'Inscrições abertas',    color: 'text-blue-500' },
  registration_closed: { label: 'Inscrições encerradas', color: 'text-yellow-500' },
  in_progress:         { label: 'Em andamento',          color: 'text-green-500' },
  completed:           { label: 'Encerrado',              color: 'text-gray-400' },
}

const placementEmoji = (p: number) => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : null

function positionLabel(pos: number) {
  if (pos === 1) return { emoji: '🥇', text: '1º lugar' }
  if (pos === 2) return { emoji: '🥈', text: '2º lugar' }
  if (pos === 3) return { emoji: '🥉', text: '3º lugar' }
  return { emoji: null, text: `${pos}º lugar` }
}

// Mostra apenas o ano de nascimento
function birthYear(birthDate: string | null): string | null {
  if (!birthDate) return null
  return String(new Date(birthDate).getFullYear())
}

function age(birthDate: string | null) {
  if (!birthDate) return null
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

export default function AthleteProfilePage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = use(params)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    apiFetch<Profile>(`/athletes/${athleteId}/profile`)
      .then(setProfile)
      .catch(() => setNotFound(true))
  }, [athleteId])

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <p className="text-lg font-medium">Atleta não encontrado</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
        </div>
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    )
  }

  const { athlete, currentClub, rankingPositions, tournamentHistory, recentResults } = profile
  const yearsOld = age(athlete.birthDate)
  const year = birthYear(athlete.birthDate)

  const activeTournaments = tournamentHistory.filter((t) => !t.withdrew)

  // Deriva colocações a partir do histórico se recentResults não vier da API
  // (compatibilidade retroativa — a API pode não retornar recentResults ainda)
  const results: TournamentResult[] = recentResults ?? []

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted flex items-center justify-center shrink-0 text-3xl font-bold text-muted-foreground border-2 border-border">
            {athlete.photoUrl
              ? <img src={athlete.photoUrl} alt={athlete.name} className="w-full h-full rounded-full object-cover" />
              : athlete.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{athlete.name}</h1>
              {!athlete.active && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Inativo</span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {currentClub && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  {currentClub.clubName}
                  {currentClub.city && ` · ${currentClub.city}, ${currentClub.state}`}
                </span>
              )}
              {/* Somente ano de nascimento — sem dia/mês */}
              {year && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {yearsOld} anos · {year}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {athlete.nationality}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              {rankingPositions.map((r) => (
                <span
                  key={r.rankingId}
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${disciplineColors[r.discipline] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                >
                  {disciplineLabel[r.discipline] ?? r.discipline}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rankings */}
      {rankingPositions.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" /> Rankings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rankingPositions.map((r) => {
              const { emoji, text } = positionLabel(r.position)
              return (
                <div
                  key={r.rankingId}
                  className={`rounded-xl border p-4 space-y-1 ${
                    r.position <= 3 ? 'border-yellow-200 bg-yellow-50/60 dark:bg-yellow-900/10' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${disciplineColors[r.discipline] ?? ''}`}>
                      {disciplineLabel[r.discipline]}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.year}</span>
                  </div>
                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <p className="text-2xl font-bold">
                        {emoji && <span className="mr-1">{emoji}</span>}{text}
                      </p>
                      {r.partnerName && (
                        <p className="text-xs text-muted-foreground mt-0.5">com {r.partnerName}</p>
                      )}
                    </div>
                    <p className="text-lg font-semibold tabular-nums text-muted-foreground">
                      {r.points.toLocaleString('pt-BR')} pts
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Últimos Resultados */}
      {results.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Medal className="w-4 h-4 text-orange-500" /> Últimos Resultados
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {results.slice(0, 10).map((r, i) => {
              const emoji = placementEmoji(r.placement)
              return (
                <Link
                  key={i}
                  href={`/t/${r.tournamentSlug}`}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 text-center text-lg">{emoji ?? <span className="text-sm font-semibold text-muted-foreground">{r.placement}º</span>}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.tournamentName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.startDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                      </span>
                      {r.partnerName && (
                        <span className="text-xs text-muted-foreground">· com {r.partnerName}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${disciplineColors[r.discipline] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {r.categoryName}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    +{r.points.toLocaleString('pt-BR')} pts
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Histórico de Torneios */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Medal className="w-4 h-4 text-blue-500" /> Histórico de Torneios
        </h2>
        {activeTournaments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            Nenhum torneio encontrado.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Torneio</span>
              <span className="text-center">Categoria</span>
              <span className="text-right">Pontos</span>
            </div>
            {activeTournaments.map((t) => {
              const status = statusLabel[t.tournamentStatus] ?? statusLabel.completed
              return (
                <Link
                  key={t.registrationId}
                  href={`/t/${t.tournamentSlug}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.tournamentName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${status.color}`}>{status.label}</span>
                      {t.city && <span className="text-xs text-muted-foreground">· {t.city}, {t.state}</span>}
                      {t.startDate && (
                        <span className="text-xs text-muted-foreground">
                          · {new Date(t.startDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${disciplineColors[t.discipline] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {t.categoryName}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {t.rankingPointsAtEntry?.toLocaleString('pt-BR') ?? '—'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
