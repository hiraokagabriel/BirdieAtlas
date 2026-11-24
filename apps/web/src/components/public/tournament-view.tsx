'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { LevelBadge } from '@/components/public/level-badge'
import { KindBadge } from '@/components/shared/kind-badge'
import { BracketDraw } from '@/components/bracket/bracket-draw'
import { BracketSkeleton } from '@/components/bracket/bracket-tree'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { ScheduleView } from '@/components/bracket/schedule-view'
import { LiveNow } from '@/components/live/live-now'
import { useLiveMatches } from '@/components/live/use-live-matches'
import { Calendar, CheckCircle2, ChevronLeft, Clock, Lock, MapPin, Users, User } from 'lucide-react'
import { DISCIPLINE_PILL, disciplineShort } from '@/lib/discipline'
import { formatDateRange } from '@/lib/format'
import { disciplineLabel, isDoublesDiscipline } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/public/status-badge'
import { ROWS } from '@/components/public/rows'
import { PrintButton } from '@/components/shared/print-button'
import { ShareControl } from '@/components/shared/share-control'
import { shareImageFilename, shareImagePath } from '@/lib/share'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/** Dados vindos do servidor (page.tsx) para o controle de compartilhar. */
export type TournamentShare = { title: string; text: string }

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
type Draw   = { id: string; published: boolean; config?: { groupCount?: number; advancePerGroup?: number; rounds?: number } | null }
type Match  = {
  id: string; round: number; position: number; status: string
  registration1Id: string | null; registration2Id: string | null
  nextMatchId: string | null; scheduledAt: string | null; courtNumber: number | null
}
type Registration = {
  id: string; athleteId: string; athlete2Id: string | null
  seed: number | null; rankingPointsAtEntry: number | null
  status: 'pending' | 'approved'
  athleteName: string | null; athlete2Name: string | null
}
type MatchResult = { matchId: string; setNumber: number; score1: number; score2: number }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Volta para a home: enquanto não houver a lista de torneios, o nível pai é o Início (docs/DESIGN.md, Voltar). */
function BackLink() {
  return (
    <Link href="/" className="-ml-2 inline-flex h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden="true" />
      Início
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-6 motion-safe:animate-pulse">
      <span className="sr-only">Carregando torneio…</span>
      <div className="space-y-3">
        <div className="h-11 w-20 rounded-sm bg-muted" />
        <div className="h-9 w-72 max-w-full rounded-sm bg-muted" />
        <div className="h-5 w-96 max-w-full rounded-sm bg-muted" />
      </div>
      <div className="h-11 w-80 max-w-full rounded-sm bg-muted" />
      <div className="h-64 rounded-lg border border-border bg-card" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página 404
// ---------------------------------------------------------------------------
function NotFound() {
  return (
    <div className="space-y-3">
      <BackLink />
      <h1 className="font-heading text-3xl font-bold leading-tight">Torneio não encontrado</h1>
      <p className="max-w-prose text-muted-foreground">
        O link que você acessou não corresponde a nenhum torneio. Confira o endereço ou busque o torneio na página inicial.
      </p>
      <Link href="/#busca" className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary-strong">
        Buscar torneios e atletas
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lista de Inscritos por categoria
// ---------------------------------------------------------------------------
function RegistrationsList({ categoryId, isDoubles }: { categoryId: string; isDoubles: boolean }) {
  const [regs, setRegs]       = useState<Registration[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Troca rápida de categoria: a resposta de uma categoria antiga não sobrescreve a atual.
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<Registration[]>(`/tournaments/categories/${categoryId}/registrations`)
      .then((data) => { if (!cancelled) setRegs(data) })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Erro inesperado.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [categoryId])

  if (loading) return (
    <div role="status" aria-busy="true" className="space-y-2 motion-safe:animate-pulse">
      <span className="sr-only">Carregando inscritos…</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted" />
      ))}
    </div>
  )

  if (error) return <ErrorNotice>Não foi possível carregar os inscritos: {error}</ErrorNotice>

  if (!regs?.length) return (
    <EmptyNotice>Nenhum inscrito ainda. Os nomes aparecem aqui assim que houver inscrições nesta categoria.</EmptyNotice>
  )

  const confirmed = regs.filter((r) => r.status === 'approved')
  const pending   = regs.filter((r) => r.status === 'pending')

  const renderRow = (r: Registration) => (
    <li key={r.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
      {isDoubles
        ? <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        : <User  className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1 break-words font-medium">
        {isDoubles
          ? `${r.athleteName ?? '—'} & ${r.athlete2Name ?? '—'}`
          : (r.athleteName ?? '—')}
      </span>
      {r.seed != null && (
        <span className="inline-flex h-5.5 items-center rounded-sm bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
          <span className="sr-only">Cabeça de chave </span>#{r.seed}
        </span>
      )}
      {r.status === 'approved'
        ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
        : <Clock        className="size-4 shrink-0 text-warning" aria-hidden="true" />}
      <span className="sr-only">{r.status === 'approved' ? 'Inscrição aprovada' : 'Inscrição pendente'}</span>
    </li>
  )

  return (
    <div className="space-y-6">
      {confirmed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-sans text-sm font-semibold text-muted-foreground">Confirmados ({confirmed.length})</h3>
          <ul className={ROWS}>{confirmed.map(renderRow)}</ul>
        </div>
      )}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-sans text-sm font-semibold text-muted-foreground">Pendentes ({pending.length})</h3>
          <ul className={ROWS}>{pending.map(renderRow)}</ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export function TournamentView({ slug, share }: { slug: string; share: TournamentShare }) {
  const [summary, setSummary]   = useState<PublicSummary | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab]           = useState<'bracket' | 'registrations' | 'schedule'>('bracket')
  const [activeCategoryId, setActiveCategoryId] = useState('')

  // Estado do chaveamento
  const [draw, setDraw]                   = useState<Draw | null>(null)
  const [drawLoaded, setDrawLoaded]       = useState(false)
  const [drawError, setDrawError]         = useState<string | null>(null)
  const [matchList, setMatchList]         = useState<Match[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [results, setResults]             = useState<MatchResult[]>([])

  // Placar ao vivo: só enquanto o torneio está em andamento. Partida encerrada recarrega chave e resumo.
  const [refreshTick, setRefreshTick] = useState(0)
  const tournamentId = summary?.tournament.id ?? null
  const isLiveTournament = summary?.tournament.status === 'in_progress'
  const liveState = useLiveMatches(isLiveTournament ? tournamentId : null, {
    onMatchEnded: () => setRefreshTick((tick) => tick + 1),
  })
  const liveByMatchId = useMemo(() => new Map(liveState.matches.map((m) => [m.matchId, m])), [liveState.matches])
  const loadedCategoryRef = useRef('')

  // 1. Busca torneio pelo slug, depois o summary
  useEffect(() => {
    apiFetch<Tournament>(`/tournaments/by-slug/${slug}`)
      .then((t) => apiFetch<PublicSummary>(`/tournaments/${t.id}/public-summary`).then(setSummary))
      .catch(() => setNotFound(true))
  }, [slug])

  // 1b. Partida encerrada ao vivo: atualiza contagens e progresso sem trocar a tela por skeleton
  useEffect(() => {
    if (refreshTick === 0 || !tournamentId) return
    apiFetch<PublicSummary>(`/tournaments/${tournamentId}/public-summary`).then(setSummary).catch(() => undefined)
  }, [refreshTick, tournamentId])

  // 2. Define categoria ativa inicial
  useEffect(() => {
    if (summary?.categories.length && !activeCategoryId) {
      setActiveCategoryId(summary.categories[0].id)
    }
  }, [summary, activeCategoryId])

  // 3. Carrega draw da categoria ativa
  useEffect(() => {
    if (!activeCategoryId) return
    // Recarga por partida encerrada é silenciosa; trocar de categoria mostra o skeleton.
    const isRefresh = loadedCategoryRef.current === activeCategoryId
    if (!isRefresh) {
      setDrawLoaded(false)
      setDrawError(null)
    }
    let cancelled = false
    Promise.all([
      apiFetch<Draw[]>(`/tournaments/categories/${activeCategoryId}/draws`),
      apiFetch<Registration[]>(`/tournaments/categories/${activeCategoryId}/registrations`),
    ]).then(async ([drawList, regs]) => {
      if (cancelled) return
      setRegistrations(regs)
      if (!drawList.length || !drawList[0].published) {
        setDraw(null); setMatchList([]); loadedCategoryRef.current = activeCategoryId; setDrawLoaded(true); return
      }
      const d = drawList[0]
      const mList = await apiFetch<Match[]>(`/draws/${d.id}/matches`)
      const allResults = await Promise.all(
        mList.map((m) => apiFetch<MatchResult[]>(`/draws/matches/${m.id}/result`))
      )
      if (cancelled) return
      setDraw(d)
      setMatchList(mList)
      setResults(allResults.flat())
      loadedCategoryRef.current = activeCategoryId
      setDrawLoaded(true)
    }).catch((err: unknown) => {
      if (cancelled || isRefresh) return
      setDrawError(err instanceof Error ? err.message : 'Erro inesperado.')
      setDrawLoaded(true)
    })
    return () => { cancelled = true }
  }, [activeCategoryId, refreshTick])

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (notFound) return <NotFound />
  if (!summary)  return <PageSkeleton />

  const { tournament, categories, stats } = summary
  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const progressPct    = stats.totalMatches > 0
    ? Math.round((stats.completedMatches / stats.totalMatches) * 100)
    : 0

  return (
    <div className="space-y-6">

      <header className="space-y-3">
        <BackLink />
        <h1 className="font-heading text-3xl font-bold leading-tight md:text-4xl">{tournament.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <StatusBadge status={tournament.status} />
          <span className="flex items-center gap-1.5">
            <LevelBadge level={tournament.level} className="bg-muted text-muted-foreground" />
            <KindBadge kind={(tournament as { kind?: string }).kind} />
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4 shrink-0" aria-hidden="true" />
            {formatDateRange(tournament.startDate, tournament.endDate)}
          </span>
          {tournament.city && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {tournament.location ? `${tournament.location} · ` : ''}{[tournament.city, tournament.state].filter(Boolean).join(', ')}
            </span>
          )}
          <span>
            {plural(stats.totalCategories, 'categoria', 'categorias')} · {plural(stats.totalAthletes, 'atleta', 'atletas')}
          </span>
        </div>

        {/* Progresso numa linha fina, sem número-herói (docs/DESIGN.md, Don'ts). */}
        {stats.totalMatches > 0 && (
          <div className="max-w-md space-y-1.5 print:hidden">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Partidas concluídas</span>
              <span className="font-medium tabular-nums">{stats.completedMatches} / {stats.totalMatches} ({progressPct}%)</span>
            </div>
            <div
              role="progressbar"
              aria-label="Progresso das partidas"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
              aria-valuetext={`${stats.completedMatches} de ${stats.totalMatches} partidas`}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <ShareControl
          className="print:hidden"
          title={share.title}
          text={share.text}
          images={[
            { label: 'Baixar imagem', href: shareImagePath(`/t/${slug}`, { download: '1' }), filename: shareImageFilename(tournament.name) },
            ...(tournament.status === 'completed'
              ? [{
                  label: 'Baixar imagem (story)',
                  href: shareImagePath(`/t/${slug}`, { format: 'portrait', download: '1' }),
                  filename: shareImageFilename(tournament.name, 'story'),
                }]
              : []),
          ]}
        />
      </header>

      {/* AO VIVO */}
      {isLiveTournament && <div className="print:hidden"><LiveNow state={liveState} /></div>}

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-8">
      {/* TABS */}
      <TabsList aria-label="Seções do torneio" className="gap-1 print:hidden">
        <TabsTrigger value="bracket" className="font-semibold">Chaveamento</TabsTrigger>
        <TabsTrigger value="registrations" className="font-semibold">Inscritos</TabsTrigger>
        <TabsTrigger value="schedule" className="font-semibold">Agenda</TabsTrigger>
      </TabsList>

      {/* SELETOR DE CATEGORIA */}
      {(tab === 'bracket' || tab === 'registrations') && categories.length > 1 && (
        <ChoiceGroup
          legend="Categoria"
          hideLegend
          className="print:hidden"
          options={categories.map((cat) => ({
            value: cat.id,
            label: cat.name,
            className: 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          }))}
          value={activeCategoryId}
          onChange={setActiveCategoryId}
          optionClassName="px-4"
        />
      )}

      {/* TAB: CHAVEAMENTO */}
      <TabsContent value="bracket" className="mt-0 space-y-0">
        <h2 className="sr-only">Chaveamento</h2>
        <div className="print-bracket-page min-w-0 space-y-3">
          {activeCategory && (
            <p className="hidden font-heading text-xl font-semibold print:block">{activeCategory.name}</p>
          )}
          {drawLoaded && draw && !drawError && (
            <div className="flex justify-end print:hidden">
              <PrintButton />
            </div>
          )}
          {!drawLoaded ? (
            <div className="rounded-lg border border-border bg-card"><BracketSkeleton /></div>
          ) : drawError ? (
            <ErrorNotice>Não foi possível carregar a chave: {drawError}</ErrorNotice>
          ) : !draw ? (
            <EmptyNotice>
              <Lock className="mx-auto mb-2 size-6 opacity-40" aria-hidden="true" />
              <span className="block font-medium text-foreground">Chave ainda não sorteada</span>
              O chaveamento desta categoria ainda não foi publicado.
            </EmptyNotice>
          ) : (
            <BracketDraw
              matches={matchList}
              registrations={registrations}
              results={results}
              activeCategory={activeCategory}
              drawId={draw.id}
              drawType={activeCategory?.drawType}
              {...(draw.config?.advancePerGroup ? { advancePerGroup: draw.config.advancePerGroup } : {})}
              readonly
              live={liveByMatchId}
            />
          )}
        </div>
      </TabsContent>

      {/* TAB: INSCRITOS */}
      <TabsContent value="registrations" className="mt-0">
      <h2 className="sr-only">Inscritos</h2>
      {activeCategory && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden="true" className={cn('inline-flex h-5.5 items-center rounded-sm px-1.5 text-xs font-bold', DISCIPLINE_PILL[activeCategory.discipline])}>
                {disciplineShort(activeCategory.discipline)}
              </span>
              {disciplineLabel(activeCategory.discipline)}
            </span>
            <span className="text-sm text-muted-foreground">
              {activeCategory.registrationCount} inscri{activeCategory.registrationCount !== 1 ? 'ções' : 'ção'}
              {' · '}
              {activeCategory.athleteCount} atleta{activeCategory.athleteCount !== 1 ? 's' : ''}
            </span>
            {activeCategory.hasPublishedDraw && (
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Chave publicada
              </span>
            )}
          </div>
          <RegistrationsList categoryId={activeCategory.id} isDoubles={isDoublesDiscipline(activeCategory.discipline)} />
        </div>
      )}
      </TabsContent>

      {/* TAB: AGENDA */}
      <TabsContent value="schedule" className="mt-0">
        <h2 className="sr-only">Agenda</h2>
        <ScheduleView
          tournamentId={tournament.id}
          categories={categories}
          readonly
        />
      </TabsContent>
      </Tabs>

    </div>
  )
}
