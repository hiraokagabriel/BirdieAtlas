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
import { TvQrCode } from './tv-qr-code'
import { BrandMark } from '@/components/shared/brand-mark'

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
      className="inline-flex h-11 items-center gap-2 rounded-md border border-field-border px-3 text-sm font-semibold transition-colors hover:bg-muted"
    >
      {active ? <Minimize className="size-4" aria-hidden="true" /> : <Maximize className="size-4" aria-hidden="true" />}
      {active ? 'Sair da tela cheia' : 'Tela cheia'}
    </button>
  )
}

function SideRow({ match, side, leader }: { match: LiveMatch; side: 1 | 2; leader: 0 | 1 | 2 }) {
  const name = side === 1 ? match.participant1 : match.participant2
  const own = (s: { score1: number; score2: number }) => (side === 1 ? s.score1 : s.score2)
  const other = (s: { score1: number; score2: number }) => (side === 1 ? s.score2 : s.score1)
  const ahead = leader === side
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
      <span className={cn('min-w-0 break-words text-2xl leading-tight lg:text-3xl', ahead ? 'font-bold' : leader === 0 ? 'font-medium' : 'font-medium text-muted-foreground')}>
        {name ?? 'A definir'}
      </span>
      <span className="flex shrink-0 items-baseline gap-3 font-heading font-bold tabular-nums">
        {match.sets.map((s, i) => (
          <span key={i} className="text-2xl text-muted-foreground lg:text-3xl">{own(s)}</span>
        ))}
        {match.currentSet && (
          // Telão: set corrente em amarelo-peteca para quem lidera o set (docs/DESIGN.md, Linha de partida), lido a 10 m.
          <span className={cn('min-w-[2ch] text-right text-5xl leading-none lg:text-6xl', own(match.currentSet) >= other(match.currentSet) ? 'text-live' : 'text-foreground')}>
            {own(match.currentSet)}
          </span>
        )}
      </span>
    </div>
  )
}

function CourtCard({ slot }: { slot: TvCourtSlot }) {
  const court = slot.court != null ? `Quadra ${slot.court}` : 'Sem quadra'
  const { live, next } = slot
  const leader = live ? (live.setsWon.side1 === live.setsWon.side2 ? 0 : live.setsWon.side1 > live.setsWon.side2 ? 1 : 2) : 0
  return (
    <li className={cn('min-w-0 rounded-lg border bg-card p-6', live ? 'border-border' : 'border-dashed border-border')}>
      <article aria-label={live ? `${court}: ${liveTitle(live)}` : `${court}: livre`} className="grid h-full grid-cols-[minmax(0,1fr)] content-start gap-3">
        <header className="flex items-center justify-between gap-3">
          {/* O número fica como texto solto do h3: um elemento só com "1" colidiria com o placar. */}
          <h3 className="shrink-0 whitespace-nowrap font-heading text-2xl font-bold uppercase tracking-wide lg:text-3xl">
            {slot.court != null ? <><span className="text-muted-foreground">Quadra</span> {slot.court}</> : <span className="text-muted-foreground">Sem quadra</span>}
          </h3>
          {live ? (
            <span className="flex min-w-0 items-baseline gap-1.5 text-lg text-muted-foreground">
              <span className="min-w-0 truncate">{live.categoryName}</span>
              <span className="shrink-0">· {live.roundLabel}</span>
            </span>
          ) : (
            <span className="rounded-sm bg-muted px-3 py-1 text-lg font-semibold text-muted-foreground">Livre</span>
          )}
        </header>
        {live ? (
          <>
            <SideRow match={live} side={1} leader={leader} />
            <SideRow match={live} side={2} leader={leader} />
            {live.winner && <p className="border-t border-border pt-2 text-xl font-semibold text-muted-foreground">Fim de jogo</p>}
          </>
        ) : next ? (
          <p className="text-2xl leading-snug">
            <span className="font-semibold">Próxima:</span> {next.participant1} × {next.participant2}
            {next.scheduledAt && <span className="text-muted-foreground"> · {formatTvTime(next.scheduledAt)}</span>}
          </p>
        ) : (
          <p className="text-xl text-muted-foreground">Sem partida na fila.</p>
        )}
      </article>
    </li>
  )
}

function QueueList({ queue }: { queue: readonly QueueMatch[] }) {
  if (queue.length === 0) return <p className="text-xl text-muted-foreground">Nenhuma partida aguardando.</p>
  return (
        // Telão (xl): faixa de uma linha no rodapé com as 4 primeiras; abaixo disso, duas colunas preenchidas de cima para baixo.
    <ol className="grid grid-cols-1 gap-x-8 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-4 xl:grid-flow-row xl:grid-cols-4 xl:grid-rows-1 xl:[&>li:nth-child(n+5)]:hidden">
      {tvUpcoming(queue, QUEUE_SHOWN).map((m) => (
        <li key={m.matchId} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-x-4 border-t border-border py-3 sm:grid-cols-[5rem_minmax(0,1fr)]">
          {m.scheduledAt ? (
            <span className="font-heading text-2xl font-bold tabular-nums">{formatTvTime(m.scheduledAt)}</span>
          ) : (
            <span className="text-2xl text-muted-foreground"><span aria-hidden="true">—</span><span className="sr-only">Sem horário</span></span>
          )}
          <span className="min-w-0">
            <span className="block break-words text-2xl font-medium leading-snug">{m.participant1} × {m.participant2}</span>
            <span className="block break-words text-lg text-muted-foreground">
              {m.courtNumber != null ? `Quadra ${m.courtNumber}` : 'Sem quadra'} · {m.categoryName} · {m.roundLabel}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function TvBoard({ tournamentId, slug, name }: { tournamentId: string; slug: string; name: string }) {
  const queryClient = useQueryClient()
  const queueKey = ['tv-queue', tournamentId]

  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    const previousScheme = root.style.colorScheme
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
    return () => {
      if (!hadDark) root.classList.remove('dark')
      root.style.colorScheme = previousScheme
    }
  }, [])
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
    // Telão: sempre escuro (contraste em projetor e TV, docs/DESIGN.md, Layout > Telão), margem de 40 a 48 px.
    <div className="dark min-h-screen space-y-8 bg-background p-4 text-foreground sm:p-8 xl:grid xl:h-screen xl:grid-rows-[auto_minmax(0,1fr)] xl:gap-8 xl:space-y-0 xl:overflow-hidden xl:px-12 xl:py-10">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <BrandMark className="size-9" />
          <div className="min-w-0">
            <h1 className="break-words font-heading text-3xl font-bold leading-tight lg:text-4xl">{name}</h1>
            <ConnectionBadge connection={live.connection} className="text-lg" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* No celular o QR não serve (quem lê já está no celular). */}
          <div className="hidden md:block"><TvQrCode path={`/t/${slug}`} /></div>
          <span className="font-heading text-4xl font-bold lg:text-5xl"><Clock /></span>
          <FullscreenButton />
          <nav aria-label="Telão">
            <Link href={`/t/${slug}`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Página do torneio
            </Link>
          </nav>
        </div>
      </header>

      <main className="space-y-8 xl:grid xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_auto] xl:gap-8 xl:space-y-0">
        <div aria-live="polite" aria-atomic="true" className="sr-only">{live.announcement}</div>
        {stale && (
          <p role="status" className="rounded-md border border-border bg-muted px-4 py-2 text-lg">
            Sem conexão com a API: os dados podem estar desatualizados. Tentando de novo.
          </p>
        )}

        {loading ? (
          <div role="status" aria-label="Carregando o telão" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-52 w-full" />
            <Skeleton className="hidden h-52 w-full md:block" />
            <Skeleton className="hidden h-52 w-full xl:block" />
            <span className="sr-only">Carregando o telão…</span>
          </div>
        ) : failed ? (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive p-4 text-xl text-destructive">
            <WifiOff className="size-5" aria-hidden="true" />
            {live.error ?? queue.error?.message ?? 'Não foi possível carregar o telão.'} Tentando de novo.
          </p>
        ) : (
          <>
            <section aria-labelledby="tv-courts" className="xl:min-h-0">
              <h2 id="tv-courts" className="sr-only">Quadras</h2>
              {slots.length === 0 ? (
                <p className="text-2xl text-muted-foreground">Nenhuma partida em quadra no momento. As quadras aparecem aqui quando a agenda distribuir as partidas.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:h-full xl:grid-cols-3 xl:grid-rows-2">
                  {slots.map((slot) => (
                    <CourtCard key={slot.live?.matchId ?? `court-${slot.court}`} slot={slot} />
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="tv-queue" className="space-y-2">
              <h2 id="tv-queue" className="font-heading text-3xl font-bold text-muted-foreground">Próximas partidas</h2>
              <QueueList queue={queue.data ?? []} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
