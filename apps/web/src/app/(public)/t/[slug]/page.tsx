'use client'

import { use, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { BracketDraw } from '@/components/bracket/bracket-draw'
import { ScheduleView } from '@/components/bracket/schedule-view'
import {
  Calendar, MapPin, Lock, Users, User,
  Trophy, CheckCircle2, Clock,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tournament = {
  id: string; name: string; slug: string; status: string; level: string
  startDate: string; endDate: string
  city: string | null; state: string | null; location: string | null
}
type CategorySummary = {
  id: string; name: string; discipline: string; drawType: string
  registrationCount: number; athleteCount: number
  matchCount: number; completedMatchCount: number
  hasPublishedDraw: boolean
}
type PublicSummary = {
  tournament: Tournament
  categories: CategorySummary[]
  stats: { totalCategories: number; totalAthletes: number; totalMatches: number; completedMatches: number }
}
type Draw   = { id: string; published: boolean }
type Match  = {
  id: string; round: number; position: number; status: string
  registration1Id: string | null; registration2Id: string | null
  nextMatchId: string | null; scheduledAt: string | null; courtNumber: number | null
}
type Registration = {
  id: string; athleteId: string; athlete2Id: string | null
  seed: number | null; rankingPointsAtEntry: number | null
  confirmed: boolean; withdrew: boolean
  athleteName: string | null; athlete2Name: string | null
}
type MatchResult = { matchId: string; setNumber: number; score1: number; score2: number }
type Athlete = { id: string; name: string }

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const statusMap: Record<string, { label: string; color: string; dot: string }> = {
  draft:                { label: 'Rascunho',              color: 'text-gray-500',   dot: 'bg-gray-300' },
  registration_open:    { label: 'Inscrições abertas',    color: 'text-blue-600',   dot: 'bg-blue-400' },
  registration_closed:  { label: 'Inscrições encerradas', color: 'text-yellow-600', dot: 'bg-yellow-400' },
  in_progress:          { label: 'Em andamento',          color: 'text-green-600',  dot: 'bg-green-500 animate-pulse' },
  completed:            { label: 'Encerrado',             color: 'text-gray-500',   dot: 'bg-gray-300' },
}

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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function PageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-8 w-72 bg-muted rounded" />
        <div className="flex gap-6">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-7 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-10 w-64 bg-muted rounded" />
      <div className="rounded-xl border border-border bg-card h-64" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página 404
// ---------------------------------------------------------------------------
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <Trophy className="w-12 h-12 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold">Torneio não encontrado</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        O link que você acessou não corresponde a nenhum torneio. Verifique se o endereço está correto.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card de Estatística
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
// Lista de Inscritos por categoria
// ---------------------------------------------------------------------------
function RegistrationsList({ categoryId, isDoubles }: { categoryId: string; isDoubles: boolean }) {
  const [regs, setRegs]       = useState<Registration[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch<Registration[]>(`/tournaments/categories/${categoryId}/registrations`)
      .then(setRegs).finally(() => setLoading(false))
  }, [categoryId])

  if (loading) return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-muted" />
      ))}
    </div>
  )

  if (!regs?.length) return (
    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum inscrito ainda.</p>
  )

  const confirmed = regs.filter((r) => r.confirmed && !r.withdrew)
  const pending   = regs.filter((r) => !r.confirmed && !r.withdrew)

  const renderRow = (r: Registration) => (
    <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      {isDoubles
        ? <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        : <User  className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <span className="flex-1 text-sm font-medium">
        {isDoubles
          ? `${r.athleteName ?? '—'} & ${r.athlete2Name ?? '—'}`
          : (r.athleteName ?? '—')}
      </span>
      {r.seed != null && (
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
          #{r.seed}
        </span>
      )}
      {r.confirmed
        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" title="Confirmado" />
        : <Clock        className="w-4 h-4 text-yellow-500 shrink-0" title="Pendente" />}
    </div>
  )

  return (
    <div className="space-y-4">
      {confirmed.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmados ({confirmed.length})</p>
          {confirmed.map(renderRow)}
        </div>
      )}
      {pending.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pendentes ({pending.length})</p>
          {pending.map(renderRow)}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function PublicTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [summary, setSummary]   = useState<PublicSummary | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab]           = useState<'bracket' | 'registrations' | 'schedule'>('bracket')
  const [activeCategoryId, setActiveCategoryId] = useState('')

  // Estado do chaveamento
  const [draw, setDraw]                   = useState<Draw | null>(null)
  const [drawLoaded, setDrawLoaded]       = useState(false)
  const [matchList, setMatchList]         = useState<Match[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [results, setResults]             = useState<MatchResult[]>([])
  const [athletes, setAthletes]           = useState<Athlete[]>([])

  // 1. Busca torneio pelo slug, depois o summary
  useEffect(() => {
    apiFetch<Tournament>(`/tournaments/by-slug/${slug}`)
      .then((t) => apiFetch<PublicSummary>(`/tournaments/${t.id}/public-summary`).then(setSummary))
      .catch(() => setNotFound(true))
  }, [slug])

  // 2. Define categoria ativa inicial
  useEffect(() => {
    if (summary?.categories.length && !activeCategoryId) {
      setActiveCategoryId(summary.categories[0].id)
    }
  }, [summary, activeCategoryId])

  // 3. Carrega draw da categoria ativa
  useEffect(() => {
    if (!activeCategoryId) return
    setDrawLoaded(false)
    Promise.all([
      apiFetch<Draw[]>(`/tournaments/categories/${activeCategoryId}/draws`),
      apiFetch<Registration[]>(`/tournaments/categories/${activeCategoryId}/registrations`),
    ]).then(async ([drawList, regs]) => {
      setRegistrations(regs)
      if (!drawList.length || !drawList[0].published) {
        setDraw(null); setMatchList([]); setDrawLoaded(true); return
      }
      const d = drawList[0]
      setDraw(d)
      const mList = await apiFetch<Match[]>(`/draws/${d.id}/matches`)
      setMatchList(mList)
      const allResults = await Promise.all(
        mList.map((m) => apiFetch<MatchResult[]>(`/draws/matches/${m.id}/result`))
      )
      setResults(allResults.flat())
      setDrawLoaded(true)
    })
  }, [activeCategoryId])

  useEffect(() => {
    if (registrations.length) apiFetch<Athlete[]>('/athletes').then(setAthletes)
  }, [registrations])

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (notFound) return <NotFound />
  if (!summary)  return <PageSkeleton />

  const { tournament, categories, stats } = summary
  const status         = statusMap[tournament.status] ?? statusMap.draft
  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const isDoubles      = ['MD', 'WD', 'XD'].includes(activeCategory?.discipline ?? '')
  const progressPct    = stats.totalMatches > 0
    ? Math.round((stats.completedMatches / stats.totalMatches) * 100)
    : 0

  return (
    <div className="space-y-8">

      {/* HERO */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {levelLabel[tournament.level] ?? tournament.level}
            </p>
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
              {tournament.location ? `${tournament.location} · ` : ''}{tournament.city}, {tournament.state}
            </span>
          )}
        </div>

        {/* Barra de progresso */}
        {stats.totalMatches > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progresso das partidas</span>
              <span className="tabular-nums font-medium">{stats.completedMatches} / {stats.totalMatches} ({progressPct}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Categorias"  value={stats.totalCategories} />
        <StatCard label="Atletas"     value={stats.totalAthletes} />
        <StatCard label="Partidas"    value={stats.totalMatches} sub={stats.completedMatches > 0 ? `${stats.completedMatches} concluídas` : undefined} />
        <StatCard label="Progresso"   value={`${progressPct}%`} sub={tournament.status === 'completed' ? 'Encerrado' : 'Em andamento'} />
      </div>

      {/* TABS */}
      <div className="flex border-b border-border gap-1">
        {(['bracket', 'registrations', 'schedule'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'bracket'       && '🏆 Chaveamento'}
            {t === 'registrations' && '👥 Inscritos'}
            {t === 'schedule'      && '📅 Agenda'}
          </button>
        ))}
      </div>

      {/* SELETOR DE CATEGORIA */}
      {(tab === 'bracket' || tab === 'registrations') && categories.length > 1 && (
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
      )}

      {/* TAB: CHAVEAMENTO */}
      {tab === 'bracket' && (
        <div className="rounded-xl border border-border bg-card overflow-auto">
          {!drawLoaded ? (
            <div className="p-12 text-center animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mx-auto" />
            </div>
          ) : !draw ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Lock className="w-8 h-8 mx-auto opacity-30" />
              <p className="font-medium">Chaveamento não disponível</p>
              <p className="text-sm">O chaveamento desta categoria ainda não foi publicado.</p>
            </div>
          ) : (
            <BracketDraw
              matches={matchList}
              registrations={registrations}
              athletes={athletes}
              results={results}
              activeCategory={activeCategory}
              drawId={draw.id}
              readonly
            />
          )}
        </div>
      )}

      {/* TAB: INSCRITOS */}
      {tab === 'registrations' && activeCategory && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
              disciplineColors[activeCategory.discipline] ?? ''
            }`}>
              {['MD','WD','XD'].includes(activeCategory.discipline)
                ? <Users className="w-3 h-3" />
                : <User  className="w-3 h-3" />}
              {disciplineLabel[activeCategory.discipline] ?? activeCategory.discipline}
            </span>
            <span className="text-sm text-muted-foreground">
              {activeCategory.registrationCount} inscri{activeCategory.registrationCount !== 1 ? 'ções' : 'ção'}
              {' · '}
              {activeCategory.athleteCount} atleta{activeCategory.athleteCount !== 1 ? 's' : ''}
            </span>
            {activeCategory.hasPublishedDraw && (
              <span className="text-xs text-green-600 font-medium">✓ Chave publicada</span>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <RegistrationsList
              categoryId={activeCategory.id}
              isDoubles={['MD','WD','XD'].includes(activeCategory.discipline)}
            />
          </div>
        </div>
      )}

      {/* TAB: AGENDA */}
      {tab === 'schedule' && (
        <ScheduleView
          tournamentId={tournament.id}
          categories={categories}
          readonly
        />
      )}

    </div>
  )
}
