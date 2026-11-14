'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Maximize, Minimize, WifiOff } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatTvTime, liveTitle, tvCourtSlots, tvUpcoming, type LiveMatch, type QueueMatch, type TvCourtSlot } from '@/lib/live'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectionBadge } from './live-now'
import { useLiveMatches } from './use-live-matches'

// Telão (TV ou projetor) de um torneio: quadras com o placar ao vivo e a fila de próximas partidas.
// Leitura pública; tempo real pelo mesmo stream da página do torneio e fila recarregada a cada 15 s.

const QUEUE_REFRESH_MS = 15_000
const QUEUE_SHOWN = 8

function Clock() {
  // Só no cliente: a hora do servidor diferiria da do navegador na hidratação.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="tabular-nums">{now ? formatTvTime(now.toISOString()) : ''}</span>
}

function FullscreenButton() {
  const [supported, setSupported] = useState(false)
  const [active, setActive] = useState(false)
  useEffect(() => {
    setSupported(typeof document.documentElement.requestFullscreen === 'function')
    const sync = () => setActive(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  if (!supported) return null
  const toggle = () => void (active ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
    >
      {active ? <Minimize className="size-4" aria-hidden="true" /> : <Maximize className="size-4" aria-hidden="true" />}
      {active ? 'Sair da tela cheia' : 'Tela cheia'}
    </button>
  )
}

function SideRow({ match, side }: { match: LiveMatch; side: 1 | 2 }) {
  const name = side === 1 ? match.participant1 : match.participant2
  const own = (s: { score1: number; score2: number }) => (side === 1 ? s.score1 : s.score2)
  const isWinner = match.winner === side
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', isWinner && 'bg-primary/10')}>
      <span className={cn('min-w-0 flex-1 truncate text-2xl lg:text-3xl', isWinner ? 'font-bold' : 'font-medium')}>{name ?? 'A definir'}</span>
      {match.sets.map((s, i) => (
        <span key={i} className="w-9 text-center text-2xl tabular-nums text-muted-foreground">{own(s)}</span>
      ))}
      {match.currentSet && (
        <span className="w-16 rounded-md bg-success/10 py-1 text-center text-4xl font-bold tabular-nums text-success lg:text-5xl">
          {own(match.currentSet)}
        </span>
      )}
    </div>
  )
}

function CourtCard({ slot }: { slot: TvCourtSlot }) {
  const court = slot.court != null ? `Quadra ${slot.court}` : 'Sem quadra'
  const { live, next } = slot
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <article aria-label={live ? `${court}: ${liveTitle(live)}` : `${court}: livre`}>
        <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2">
          <h3 className={cn('text-xl font-bold', live ? 'text-success' : 'text-muted-foreground')}>{court}</h3>
          {live && <span className="truncate text-base text-muted-foreground">{live.categoryName} · {live.roundLabel}</span>}
        </header>
        {live ? (
          <>
            <SideRow match={live} side={1} />
            <div className="border-t border-border" />
            <SideRow match={live} side={2} />
            {live.winner && <p className="border-t border-border px-4 py-2 text-base font-medium text-muted-foreground">Fim de jogo</p>}
          </>
        ) : (
          <div className="space-y-1 px-4 py-4">
            <p className="text-lg font-medium text-muted-foreground">Livre</p>
            {next && (
              <p className="text-xl">
                <span className="font-semibold">Próxima:</span> {next.participant1} × {next.participant2}
                {next.scheduledAt && <span className="text-muted-foreground"> · {formatTvTime(next.scheduledAt)}</span>}
              </p>
            )}
          </div>
        )}
      </article>
    </li>
  )
}

function QueueList({ queue }: { queue: readonly QueueMatch[] }) {
  if (queue.length === 0) return <p className="text-lg text-muted-foreground">Nenhuma partida aguardando.</p>
  return (
    <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
      {tvUpcoming(queue, QUEUE_SHOWN).map((m) => (
        <li key={m.matchId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
          <span className="w-14 shrink-0 text-xl font-semibold tabular-nums">{formatTvTime(m.scheduledAt) || '--:--'}</span>
          <span className="w-24 shrink-0 text-lg text-muted-foreground">{m.courtNumber != null ? `Quadra ${m.courtNumber}` : 'Sem quadra'}</span>
          <span className="min-w-0 flex-1 text-xl font-medium">{m.participant1} × {m.participant2}</span>
          <span className="text-base text-muted-foreground">{m.categoryName} · {m.roundLabel}</span>
        </li>
      ))}
    </ol>
  )
}

export function TvBoard({ tournamentId, slug, name }: { tournamentId: string; slug: string; name: string }) {
  const queryClient = useQueryClient()
  const queueKey = ['tv-queue', tournamentId]
  const refreshQueue = () => void queryClient.invalidateQueries({ queryKey: queueKey })
  const live = useLiveMatches(tournamentId, { onMatchEnded: refreshQueue })
  const queue = useQuery({
    queryKey: queueKey,
    queryFn: () => apiFetch<QueueMatch[]>(`/tournaments/${tournamentId}/live/queue`),
    refetchInterval: QUEUE_REFRESH_MS,
  })

  // Partida que começa sai da fila: recarrega quando aumenta o número de partidas ao vivo (o fim já vem por onMatchEnded).
  const liveCount = live.matches.length
  const previousLiveCount = useRef<number | null>(null)
  useEffect(() => {
    if (!live.loaded) return
    const previous = previousLiveCount.current
    previousLiveCount.current = liveCount
    if (previous !== null && liveCount > previous) void queryClient.invalidateQueries({ queryKey: ['tv-queue', tournamentId] })
  }, [live.loaded, liveCount, queryClient, tournamentId])

  const loading = (!live.loaded && !live.error) || queue.isPending
  const failed = (live.error && !live.loaded) || (queue.isError && !queue.data)
  const slots = tvCourtSlots(live.matches, queue.data ?? [])
  // Com dados na tela, uma falha posterior não some: avisa que podem estar desatualizados.
  const stale = !loading && !failed && (queue.isError || live.error !== null)

  return (
    <div className="min-h-screen space-y-6 bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight lg:text-4xl">{name}</h1>
          <ConnectionBadge connection={live.connection} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-3xl font-semibold lg:text-4xl"><Clock /></span>
          <FullscreenButton />
          <nav aria-label="Telão">
            <Link href={`/t/${slug}`} className="inline-flex min-h-10 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Página do torneio
            </Link>
          </nav>
        </div>
      </header>

      <main className="space-y-6">
        <div aria-live="polite" aria-atomic="true" className="sr-only">{live.announcement}</div>
        {stale && (
          <p role="status" className="rounded-lg border border-warning px-4 py-2 text-base text-warning">
            Sem conexão com a API: os dados podem estar desatualizados. Tentando de novo.
          </p>
        )}

        {loading ? (
          <div role="status" aria-label="Carregando o telão" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="hidden h-40 w-full md:block" />
            <span className="sr-only">Carregando o telão…</span>
          </div>
        ) : failed ? (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive p-4 text-lg text-destructive">
            <WifiOff className="size-5" aria-hidden="true" />
            {live.error ?? queue.error?.message ?? 'Não foi possível carregar o telão.'} Tentando de novo.
          </p>
        ) : (
          <>
            <section aria-labelledby="tv-courts">
              <h2 id="tv-courts" className="sr-only">Quadras</h2>
              {slots.length === 0 ? (
                <p className="text-xl text-muted-foreground">Nenhuma partida em quadra no momento.</p>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {slots.map((slot) => (
                    <CourtCard key={slot.live?.matchId ?? `court-${slot.court}`} slot={slot} />
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="tv-queue" className="space-y-3">
              <h2 id="tv-queue" className="text-2xl font-bold">Próximas partidas</h2>
              <QueueList queue={queue.data ?? []} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
