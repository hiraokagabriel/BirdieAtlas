'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { AlertTriangle, CheckCircle2, Loader2, Play, Plus, RefreshCw, Undo2 } from 'lucide-react'
import { ApiError, apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import {
  asLiveMatch,
  formatLiveScore,
  knownCourts,
  liveOnCourt,
  liveReducer,
  liveTitle,
  queueOnCourt,
  setsSummary,
  type LiveMatch,
  type QueueMatch,
  type Side,
} from '@/lib/live'

// Tela do operador de quadra (celular e tablet): escolhe torneio e quadra, inicia a partida e marca
// os pontos. O placar é provisório até "Encerrar partida", que grava o resultado oficial pela API.

type TournamentOption = { id: string; name: string; status: string }

const STORAGE_TOURNAMENT = 'birdie.live.tournament'
const STORAGE_COURT = 'birdie.live.court'
const NO_COURT = 'none'

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Navegação privada ou armazenamento bloqueado: a escolha só não é lembrada.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado.'
}

// ---------------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------------

function useLiveActions(tournamentId: string, onError: (message: string | null) => void) {
  const queryClient = useQueryClient()
  const liveKey = useMemo(() => ['live', tournamentId], [tournamentId])
  const queueKey = useMemo(() => ['live-queue', tournamentId], [tournamentId])

  const putMatch = (match: LiveMatch) =>
    queryClient.setQueryData<LiveMatch[]>(liveKey, (old) => liveReducer(old ?? [], { type: 'match', match }))
  const dropMatch = (matchId: string) =>
    queryClient.setQueryData<LiveMatch[]>(liveKey, (old) => (old ?? []).filter((m) => m.matchId !== matchId))
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: liveKey })
    void queryClient.invalidateQueries({ queryKey: queueKey })
  }

  const handleError = (error: unknown) => {
    // Outro operador mexeu antes: a resposta traz o placar atual, que passa a valer na tela.
    if (error instanceof ApiError && error.code === 'LIVE_VERSION_CONFLICT' && isRecord(error.details)) {
      const current = asLiveMatch(error.details.current)
      if (current) putMatch(current)
    }
    onError(errorMessage(error))
    refresh()
  }

  const post = <T,>(path: string, json?: unknown) =>
    apiFetch<T>(path, { method: 'POST', ...(json !== undefined ? { json } : {}) })

  const start = useMutation({
    mutationFn: (vars: { matchId: string; courtNumber?: number }) =>
      post<LiveMatch>(`/draws/matches/${vars.matchId}/live/start`, vars.courtNumber !== undefined ? { courtNumber: vars.courtNumber } : {}),
    onSuccess: (match) => {
      onError(null)
      putMatch(match)
      refresh()
    },
    onError: handleError,
  })
  const point = useMutation({
    mutationFn: (vars: { match: LiveMatch; side: Side }) =>
      post<LiveMatch>(`/draws/matches/${vars.match.matchId}/live/point`, { side: vars.side, version: vars.match.version }),
    onSuccess: (match) => {
      onError(null)
      putMatch(match)
    },
    onError: handleError,
  })
  const undo = useMutation({
    mutationFn: (match: LiveMatch) => post<LiveMatch>(`/draws/matches/${match.matchId}/live/undo`, { version: match.version }),
    onSuccess: (match) => {
      onError(null)
      putMatch(match)
    },
    onError: handleError,
  })
  const finish = useMutation({
    mutationFn: (match: LiveMatch) => post<unknown>(`/draws/matches/${match.matchId}/live/finish`, { version: match.version }),
    onSuccess: (_data, match) => {
      onError(null)
      dropMatch(match.matchId)
      refresh()
    },
    onError: handleError,
  })
  const cancel = useMutation({
    mutationFn: (match: LiveMatch) => post<unknown>(`/draws/matches/${match.matchId}/live/cancel`),
    onSuccess: (_data, match) => {
      onError(null)
      dropMatch(match.matchId)
      refresh()
    },
    onError: handleError,
  })

  const busy = start.isPending || point.isPending || undo.isPending || finish.isPending || cancel.isPending
  return { start, point, undo, finish, cancel, busy }
}

type LiveActions = ReturnType<typeof useLiveActions>

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  pending: boolean
  onConfirm: () => void
  onClose: () => void
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" className="h-12 text-base" onClick={onClose} disabled={pending}>
            Voltar
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} className="h-12 text-base" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SidePanel({
  name,
  side,
  match,
  disabled,
  pending,
  onPoint,
}: {
  name: string | null
  side: Side
  match: LiveMatch
  disabled: boolean
  pending: boolean
  onPoint: (side: Side) => void
}) {
  const current = match.currentSet
  const score = current ? (side === 1 ? current.score1 : current.score2) : 0
  const won = side === 1 ? match.setsWon.side1 : match.setsWon.side2
  const isWinner = match.winner === side
  const display = name ?? 'A definir'
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4', isWinner ? 'border-primary bg-primary/5' : 'border-border')}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-lg font-semibold leading-tight">{display}</p>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {won} {won === 1 ? 'set' : 'sets'}
        </span>
      </div>
      <p aria-hidden="true" className="text-center text-7xl font-bold leading-none tabular-nums">
        {current ? score : '—'}
      </p>
      <Button
        className="h-20 w-full text-xl"
        onClick={() => onPoint(side)}
        disabled={disabled}
        aria-label={`Marcar ponto para ${display}`}
      >
        {pending ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <Plus className="size-6" aria-hidden="true" />}
        1 ponto
      </Button>
    </div>
  )
}

function Scoreboard({ match, actions, onError }: { match: LiveMatch; actions: LiveActions; onError: (m: string | null) => void }) {
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const decided = match.winner !== null
  const hasPoints = match.sets.length > 0 || (match.currentSet !== null && (match.currentSet.score1 > 0 || match.currentSet.score2 > 0))
  const winnerName = match.winner === 1 ? match.participant1 : match.winner === 2 ? match.participant2 : null
  const score = formatLiveScore(match) || '0-0'

  const pointDisabled = decided || actions.busy
  const pointPendingFor = (side: Side) => actions.point.isPending && actions.point.variables?.side === side

  return (
    <section aria-label={`Partida ao vivo: ${liveTitle(match)}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {match.categoryName} · {match.roundLabel}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span aria-hidden="true" className="size-2 rounded-full bg-success motion-safe:animate-pulse" />
          Ao vivo · {setsSummary(match)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SidePanel name={match.participant1} side={1} match={match} disabled={pointDisabled} pending={pointPendingFor(1)} onPoint={(side) => actions.point.mutate({ match, side })} />
        <SidePanel name={match.participant2} side={2} match={match} disabled={pointDisabled} pending={pointPendingFor(2)} onPoint={(side) => actions.point.mutate({ match, side })} />
      </div>

      <p className="text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
        <span className="sr-only">Placar: </span>
        {score}
        {match.currentSet && <span> · set {match.currentSet.setNumber} em andamento</span>}
      </p>

      {decided && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm font-medium">
          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {winnerName ?? 'Participante'} venceu. Confira o placar e encerre a partida.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-14 text-base"
          onClick={() => actions.undo.mutate(match)}
          disabled={!hasPoints || actions.busy}
        >
          {actions.undo.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
          Desfazer último ponto
        </Button>
        <Button className="h-14 text-base" onClick={() => setConfirmFinish(true)} disabled={!decided || actions.busy}>
          <CheckCircle2 aria-hidden="true" />
          Encerrar partida
        </Button>
      </div>

      <Button variant="ghost" className="h-11 w-full text-sm text-muted-foreground" onClick={() => setConfirmCancel(true)} disabled={actions.busy}>
        Cancelar início da partida
      </Button>

      <ConfirmDialog
        open={confirmFinish}
        title="Encerrar partida?"
        description="O placar vira o resultado oficial e o vencedor avança na chave."
        confirmLabel="Confirmar resultado"
        pending={actions.finish.isPending}
        onClose={() => setConfirmFinish(false)}
        onConfirm={() => actions.finish.mutate(match, { onSettled: () => setConfirmFinish(false) })}
      >
        <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium">{liveTitle(match)}</p>
          <p className="tabular-nums text-muted-foreground">{score}</p>
          {winnerName && <p className="font-semibold">Vencedor: {winnerName}</p>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar o início?"
        description="O placar provisório é descartado e a partida volta a ficar pendente."
        confirmLabel="Descartar placar"
        destructive
        pending={actions.cancel.isPending}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          onError(null)
          actions.cancel.mutate(match, { onSettled: () => setConfirmCancel(false) })
        }}
      />
    </section>
  )
}

function QueueItem({
  item,
  highlight,
  startLabel,
  disabled,
  starting,
  onStart,
}: {
  item: QueueMatch
  highlight: boolean
  startLabel: string
  disabled: boolean
  starting: boolean
  onStart: () => void
}) {
  return (
    <li className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center', highlight ? 'border-primary/50' : 'border-border')}>
      <div className="min-w-0 flex-1 space-y-0.5">
        {highlight && <p className="text-xs font-semibold uppercase tracking-wider text-primary">Próxima partida</p>}
        <p className="text-base font-semibold leading-tight">{item.participant1}</p>
        <p className="text-sm text-muted-foreground">contra</p>
        <p className="text-base font-semibold leading-tight">{item.participant2}</p>
        <p className="pt-1 text-xs text-muted-foreground">
          {item.categoryName} · {item.roundLabel}
          {item.scheduledAt && ` · ${new Date(item.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
        </p>
      </div>
      <Button className="h-14 text-base sm:w-44" variant={highlight ? 'default' : 'outline'} onClick={onStart} disabled={disabled}>
        {starting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
        {startLabel}
      </Button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

function ConsoleSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

function CourtPanel({ tournamentId }: { tournamentId: string }) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [court, setCourt] = useState<string | null>(null)

  const liveQuery = useQuery({
    queryKey: ['live', tournamentId],
    queryFn: () => apiFetch<LiveMatch[]>(`/tournaments/${tournamentId}/live/matches`),
    refetchInterval: 3_000,
  })
  const queueQuery = useQuery({
    queryKey: ['live-queue', tournamentId],
    queryFn: () => apiFetch<QueueMatch[]>(`/tournaments/${tournamentId}/live/queue`),
    refetchInterval: 8_000,
  })
  const actions = useLiveActions(tournamentId, setActionError)

  const live = useMemo(() => liveQuery.data ?? [], [liveQuery.data])
  const queue = useMemo(() => queueQuery.data ?? [], [queueQuery.data])
  const courts = useMemo(() => knownCourts(live, queue), [live, queue])
  const hasUnassigned = live.some((m) => m.courtNumber === null) || queue.some((m) => m.courtNumber === null)
  // A quadra escolhida fica nas abas mesmo se a lista ao vivo ficar sem ela por um instante (ex.: cancelar o
  // início tira a partida de `live` antes de a fila recarregar); senão o efeito abaixo trocaria para a primeira.
  const tabs = useMemo(() => {
    const picked = court !== null && court !== NO_COURT ? Number(court) : null
    const numbers = picked !== null && Number.isInteger(picked) && !courts.includes(picked)
      ? [...courts, picked].sort((a, b) => a - b)
      : courts
    return [...numbers.map(String), ...(hasUnassigned ? [NO_COURT] : [])]
  }, [courts, hasUnassigned, court])

  // Lembra a quadra e, na primeira carga, escolhe a que já tem partida ao vivo (ou a primeira).
  useEffect(() => {
    if (tabs.length === 0) return
    if (court !== null && tabs.includes(court)) return
    const saved = readStorage(`${STORAGE_COURT}.${tournamentId}`)
    const withLive = live.find((m) => m.courtNumber !== null)
    const pick = saved && tabs.includes(saved) ? saved : withLive ? String(withLive.courtNumber) : (tabs[0] ?? null)
    setCourt(pick)
  }, [tabs, court, live, tournamentId])

  const selectCourt = (value: string) => {
    setCourt(value)
    setActionError(null)
    writeStorage(`${STORAGE_COURT}.${tournamentId}`, value)
  }

  if (liveQuery.isLoading || queueQuery.isLoading) return <ConsoleSkeleton />
  if (liveQuery.isError && !liveQuery.data) {
    return (
      <div className="space-y-3">
        <ErrorNotice>Não foi possível carregar o placar: {errorMessage(liveQuery.error)}</ErrorNotice>
        <Button variant="outline" className="h-11" onClick={() => void liveQuery.refetch()}>
          <RefreshCw aria-hidden="true" /> Tentar de novo
        </Button>
      </div>
    )
  }
  if (queueQuery.isError && !queueQuery.data) {
    return <ErrorNotice>Não foi possível carregar a fila de partidas: {errorMessage(queueQuery.error)}</ErrorNotice>
  }
  if (tabs.length === 0 && live.length === 0 && queue.length === 0) {
    return (
      <EmptyNotice>
        Nenhuma partida pronta para começar neste torneio. Gere e publique as chaves, e defina as quadras na aba Agenda do torneio.
      </EmptyNotice>
    )
  }

  const courtNumber = court === null || court === NO_COURT ? null : Number(court)
  const liveHere = court === null ? undefined : liveOnCourt(live, courtNumber)
  const queueHere = court === null ? [] : queueOnCourt(queue, courtNumber)
  const unassigned = courtNumber === null ? [] : queueOnCourt(queue, null)
  const blockedByLive = liveHere !== undefined

  const start = (item: QueueMatch) => {
    setActionError(null)
    actions.start.mutate({ matchId: item.matchId, ...(courtNumber !== null && item.courtNumber === null ? { courtNumber } : {}) })
  }
  const startingId = actions.start.isPending ? actions.start.variables?.matchId : undefined

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Quadras" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const n = tab === NO_COURT ? null : Number(tab)
          const isLive = liveOnCourt(live, n) !== undefined
          const selected = tab === court
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={selected}
              onClick={() => selectCourt(tab)}
              className={cn(
                'flex min-h-14 min-w-24 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-4 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted',
              )}
            >
              <span>{n === null ? 'Sem quadra' : `Quadra ${n}`}</span>
              <span className={cn('flex items-center gap-1 text-xs font-medium', selected ? 'text-primary-foreground/90' : 'text-muted-foreground')}>
                {isLive && <span aria-hidden="true" className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" />}
                {isLive ? 'Ao vivo' : `${queueOnCourt(queue, n).length} na fila`}
              </span>
            </button>
          )
        })}
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{actionError}</span>
          <button type="button" className="shrink-0 rounded px-1 font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setActionError(null)}>
            Fechar
          </button>
        </div>
      )}

      {liveHere ? (
        <Scoreboard key={liveHere.matchId} match={liveHere} actions={actions} onError={setActionError} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma partida em andamento {courtNumber !== null ? `na quadra ${courtNumber}` : 'sem quadra'}.
        </p>
      )}

      {queueHere.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {blockedByLive ? 'Depois desta' : 'Fila da quadra'}
          </h3>
          <ul className="space-y-3">
            {queueHere.map((item, index) => (
              <QueueItem
                key={item.matchId}
                item={item}
                highlight={!blockedByLive && index === 0}
                startLabel="Iniciar"
                disabled={blockedByLive || actions.busy}
                starting={startingId === item.matchId}
                onStart={() => start(item)}
              />
            ))}
          </ul>
        </div>
      )}
      {queueHere.length === 0 && !liveHere && (
        <EmptyNotice>Sem partidas na fila desta quadra.</EmptyNotice>
      )}

      {unassigned.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sem quadra definida</h3>
          <ul className="space-y-3">
            {unassigned.map((item) => (
              <QueueItem
                key={item.matchId}
                item={item}
                highlight={false}
                startLabel={`Iniciar na quadra ${courtNumber}`}
                disabled={blockedByLive || actions.busy}
                starting={startingId === item.matchId}
                onStart={() => start(item)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function CourtConsole() {
  const [tournamentId, setTournamentId] = useState<string | null>(null)

  const tournamentsQuery = useQuery({
    queryKey: ['live-tournaments'],
    queryFn: () => apiFetch<Paginated<TournamentOption>>('/tournaments?pageSize=100'),
  })
  const options = useMemo(
    () => (tournamentsQuery.data?.data ?? []).filter((t) => t.status === 'in_progress'),
    [tournamentsQuery.data],
  )

  useEffect(() => {
    if (options.length === 0) return
    if (tournamentId !== null && options.some((t) => t.id === tournamentId)) return
    const saved = readStorage(STORAGE_TOURNAMENT)
    setTournamentId(options.find((t) => t.id === saved)?.id ?? options[0]?.id ?? null)
  }, [options, tournamentId])

  if (tournamentsQuery.isLoading) return <ConsoleSkeleton />
  if (tournamentsQuery.isError) {
    return (
      <div className="space-y-3">
        <ErrorNotice>Não foi possível carregar os torneios: {errorMessage(tournamentsQuery.error)}</ErrorNotice>
        <Button variant="outline" className="h-11" onClick={() => void tournamentsQuery.refetch()}>
          <RefreshCw aria-hidden="true" /> Tentar de novo
        </Button>
      </div>
    )
  }
  if (options.length === 0) {
    return <EmptyNotice>Nenhum torneio em andamento. Coloque um torneio em andamento para operar o placar.</EmptyNotice>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="live-tournament" className="text-sm font-medium">
          Torneio
        </label>
        <select
          id="live-tournament"
          value={tournamentId ?? ''}
          onChange={(event) => {
            setTournamentId(event.target.value)
            writeStorage(STORAGE_TOURNAMENT, event.target.value)
          }}
          className="h-12 w-full rounded-xl border border-field-border bg-background px-3 text-base focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {tournamentId && <CourtPanel key={tournamentId} tournamentId={tournamentId} />}
    </div>
  )
}
