'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  User, MapPin, Trophy, Calendar, Users, Award, Shield,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Athlete = {
  id: string
  name: string
  gender: 'M' | 'F'
  nationality: string
  photoUrl: string | null
  active: boolean
}

type CurrentClub = {
  clubId: string
  clubName: string | null
  clubSlug: string | null
  city: string | null
  state: string | null
  startedAt: string | null
} | null

type RankingPosition = {
  rankingId: string
  rankingName: string
  discipline: string
  year: number
  position: number | null
  totalPoints: number | null
  partnerId: string | null
  partnerName: string | null
}

type TournamentEntry = {
  registrationId: string
  seed: number | null
  withdrew: boolean
  finalPlacement: number | null
  categoryId: string
  categoryName: string
  discipline: string
  tournamentId: string
  tournamentName: string
  tournamentSlug: string
  tournamentStatus: string
  startDate: string
  endDate: string
  level: string
  city: string
  state: string
}

type ProfileData = {
  athlete: Athlete
  currentClub: CurrentClub
  rankingPositions: RankingPosition[]
  tournamentHistory: TournamentEntry[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.',  WD: 'Duplas Fem.', XD: 'Misto',
}

const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-50 text-blue-700 border-blue-200',
  WS: 'bg-purple-50 text-purple-700 border-purple-200',
  MD: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-50 text-pink-700 border-pink-200',
  XD: 'bg-orange-50 text-orange-700 border-orange-200',
}

const levelLabel: Record<string, string> = {
  local: 'Local', estadual: 'Estadual', regional: 'Regional',
  nacional: 'Nacional', internacional: 'Internacional',
}

const statusLabel: Record<string, string> = {
  draft: 'Rascunho',
  registration_open: 'Inscrições abertas',
  registration_closed: 'Inscrições encerradas',
  in_progress: 'Em andamento',
  completed: 'Encerrado',
}

function placementBadge(placement: number | null): string {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  if (placement === 3) return '🥉'
  if (placement !== null) return `${placement}º`
  return '—'
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function PageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-muted shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-7 w-56 bg-muted rounded" />
            <div className="h-4 w-36 bg-muted rounded" />
            <div className="h-4 w-44 bg-muted rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-7 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-10 w-64 bg-muted rounded" />
      <div className="rounded-xl border border-border bg-card h-48" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <User className="w-12 h-12 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold">Atleta não encontrado</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        O link que você acessou não corresponde a nenhum atleta. Verifique se o endereço está correto.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-0.5">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function PublicAthletePage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = use(params)

  const [profile, setProfile]   = useState<ProfileData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab]           = useState<'rankings' | 'history'>('rankings')

  useEffect(() => {
    apiFetch<ProfileData>(`/athletes/${athleteId}/profile`)
      .then(setProfile)
      .catch(() => setNotFound(true))
  }, [athleteId])

  if (notFound)  return <NotFound />
  if (!profile)  return <PageSkeleton />

  const { athlete, currentClub, rankingPositions, tournamentHistory } = profile

  // Stats de resumo
  const totalTournaments = new Set(tournamentHistory.map((t) => t.tournamentId)).size
  const bestRanking = rankingPositions.reduce<number | null>((best, r) => {
    if (r.position === null) return best
    if (best === null) return r.position
    return r.position < best ? r.position : best
  }, null)
  const podiums = tournamentHistory.filter(
    (t) => t.finalPlacement !== null && t.finalPlacement <= 3
  ).length

  return (
    <div className="space-y-8">

      {/* HERO */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-5 flex-wrap">

          {/* Avatar */}
          {athlete.photoUrl ? (
            <img
              src={athlete.photoUrl}
              alt={athlete.name}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
              <span className="text-2xl font-bold text-muted-foreground select-none">
                {initials(athlete.name)}
              </span>
            </div>
          )}

          {/* Info principal */}
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{athlete.name}</h1>
              {!athlete.active && (
                <span className="text-xs font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5">
                  Inativo
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                {athlete.gender === 'M' ? 'Masculino' : 'Feminino'}
              </span>
              {athlete.nationality && (
                <span className="flex items-center gap-1.5">
                  <span className="text-base leading-none">
                    {athlete.nationality === 'BR' ? '🇧🇷' : athlete.nationality}
                  </span>
                  {athlete.nationality}
                </span>
              )}
            </div>

            {currentClub ? (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium text-foreground">{currentClub.clubName}</span>
                {currentClub.city && (
                  <span>· {currentClub.city}{currentClub.state ? `, ${currentClub.state}` : ''}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem clube ativo</p>
            )}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Torneios"
          value={totalTournaments}
          sub={totalTournaments !== 1 ? 'participações' : 'participação'}
        />
        <StatCard
          label="Melhor ranking"
          value={bestRanking !== null ? `${bestRanking}º` : '—'}
          sub={bestRanking !== null ? 'posição' : 'sem dados'}
        />
        <StatCard
          label="Pódios"
          value={podiums}
          sub={podiums !== 1 ? 'top 3' : 'top 3'}
        />
      </div>

      {/* TABS */}
      <div className="flex border-b border-border gap-1">
        {(['rankings', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'rankings' && '🏅 Rankings'}
            {t === 'history'  && '📋 Histórico'}
          </button>
        ))}
      </div>

      {/* TAB: RANKINGS */}
      {tab === 'rankings' && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {rankingPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Award className="w-8 h-8 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Sem posição em rankings</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Este atleta ainda não aparece em nenhum ranking calculado.
              </p>
            </div>
          ) : (
            rankingPositions
              .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
              .map((r) => (
                <div key={r.rankingId} className="flex items-center gap-4 px-4 py-3 flex-wrap">
                  {/* Posição */}
                  <div className="w-10 text-center">
                    <span className="text-lg font-bold tabular-nums">
                      {r.position !== null ? `${r.position}º` : '—'}
                    </span>
                  </div>

                  {/* Ranking info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.rankingName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                        disciplineColors[r.discipline] ?? 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {['MD','WD','XD'].includes(r.discipline)
                          ? <Users className="w-2.5 h-2.5" />
                          : <User  className="w-2.5 h-2.5" />}
                        {disciplineLabel[r.discipline] ?? r.discipline}
                      </span>
                      {r.year > 0 && (
                        <span className="text-xs text-muted-foreground">{r.year}</span>
                      )}
                      {r.partnerName && (
                        <span className="text-xs text-muted-foreground">
                          c/ {r.partnerName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pontos */}
                  {r.totalPoints !== null && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {r.totalPoints.toLocaleString('pt-BR')} pts
                      </p>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* TAB: HISTÓRICO */}
      {tab === 'history' && (
        <div className="space-y-3">
          {tournamentHistory.length === 0 ? (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Sem histórico de torneios</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Nenhum torneio confirmado encontrado para este atleta.
              </p>
            </div>
          ) : (
            tournamentHistory.map((entry) => (
              <div
                key={entry.registrationId}
                className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-4 flex-wrap"
              >
                {/* Placement badge */}
                <div className="w-8 text-center text-xl leading-none shrink-0">
                  {entry.finalPlacement !== null
                    ? placementBadge(entry.finalPlacement)
                    : <Trophy className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                </div>

                {/* Tournament info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{entry.tournamentName}</p>
                    {entry.seed !== null && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        #{entry.seed}
                      </span>
                    )}
                    {entry.withdrew && (
                      <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        Retirada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${
                      disciplineColors[entry.discipline] ?? 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {disciplineLabel[entry.discipline] ?? entry.discipline}
                    </span>
                    {entry.level && (
                      <span>{levelLabel[entry.level] ?? entry.level}</span>
                    )}
                    {entry.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {entry.city}{entry.state ? `, ${entry.state}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Data + status */}
                <div className="text-right text-xs text-muted-foreground shrink-0 space-y-0.5">
                  {entry.startDate && (
                    <p className="flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3" />
                      {new Date(entry.startDate).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  )}
                  <p>{statusLabel[entry.tournamentStatus] ?? entry.tournamentStatus}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  )
}
