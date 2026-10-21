import { Radio, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { Skeleton } from '@/components/ui/skeleton'
import { CONNECTION_LABEL, formatLiveScore, liveTitle, type LiveConnection, type LiveMatch } from '@/lib/live'
import type { LiveMatchesState } from './use-live-matches'

const CONNECTION_STYLE: Record<LiveConnection, { text: string; dot: string }> = {
  connecting: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  live: { text: 'text-success', dot: 'bg-success motion-safe:animate-pulse' },
  reconnecting: { text: 'text-warning', dot: 'bg-warning motion-safe:animate-pulse' },
  polling: { text: 'text-info', dot: 'bg-info' },
}

/** Estado da conexão, sempre visível: o público precisa saber se o placar está chegando. */
export function ConnectionBadge({ connection }: { connection: LiveConnection }) {
  const style = CONNECTION_STYLE[connection]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', style.text)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', style.dot)} />
      {CONNECTION_LABEL[connection]}
    </span>
  )
}

function ScoreCell({ value, highlight }: { value: number; highlight: boolean }) {
  return (
    <span
      className={cn(
        'w-7 text-center text-base tabular-nums',
        highlight ? 'font-bold text-foreground' : 'text-muted-foreground',
      )}
    >
      {value}
    </span>
  )
}

function LiveRow({ name, side, match }: { name: string | null; side: 1 | 2; match: LiveMatch }) {
  const own = (s: { score1: number; score2: number }) => (side === 1 ? s.score1 : s.score2)
  const other = (s: { score1: number; score2: number }) => (side === 1 ? s.score2 : s.score1)
  const isWinner = match.winner === side
  return (
    <div className={cn('flex h-11 items-center gap-2 border-l-[3px] px-3', isWinner ? 'border-primary bg-primary/10' : 'border-transparent')}>
      <span className={cn('min-w-0 flex-1 truncate text-sm', isWinner ? 'font-semibold' : 'font-medium')}>{name ?? 'A definir'}</span>
      <span className="flex shrink-0 items-center gap-1">
        {match.sets.map((s, i) => (
          <ScoreCell key={i} value={own(s)} highlight={own(s) > other(s)} />
        ))}
        {match.currentSet && (
          <span className="ml-1 w-9 rounded-md bg-success/10 py-0.5 text-center text-lg font-bold tabular-nums text-success">
            {own(match.currentSet)}
          </span>
        )}
      </span>
    </div>
  )
}

function LiveCard({ match }: { match: LiveMatch }) {
  const court = match.courtNumber != null ? `Quadra ${match.courtNumber}` : 'Sem quadra'
  const label = `${court}, ${match.categoryName}, ${match.roundLabel}: ${liveTitle(match)}, placar ${formatLiveScore(match) || 'zero a zero'}`
  return (
    <li>
      <article aria-label={label} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" />
            {court}
          </span>
          <span className="truncate text-muted-foreground">
            {match.categoryName} · {match.roundLabel}
          </span>
        </header>
        <LiveRow name={match.participant1} side={1} match={match} />
        <div className="border-t border-border" />
        <LiveRow name={match.participant2} side={2} match={match} />
        {match.winner && (
          <p className="border-t border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Fim de jogo, aguardando confirmação da mesa
          </p>
        )}
      </article>
    </li>
  )
}

/**
 * "Ao vivo agora": partidas em andamento do torneio. A região aria-live anuncia só início, fim de
 * set e fim de jogo; pontos soltos mudam a tela mas não falam.
 */
export function LiveNow({ state }: { state: LiveMatchesState }) {
  const { matches, connection, loaded, error, announcement } = state
  return (
    <section aria-labelledby="live-now-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-now-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Radio className="size-5 text-success" aria-hidden="true" />
          Ao vivo agora
        </h2>
        <ConnectionBadge connection={connection} />
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {error && loaded && (
        <p role="status" className="text-xs text-warning">
          {error} Tentando de novo.
        </p>
      )}

      {!loaded && !error ? (
        <div role="status" aria-label="Carregando partidas ao vivo" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="hidden h-28 w-full sm:block" />
          <span className="sr-only">Carregando partidas ao vivo…</span>
        </div>
      ) : error && !loaded ? (
        <ErrorNotice>
          <WifiOff className="mr-2 inline size-4" aria-hidden="true" />
          {error}
        </ErrorNotice>
      ) : matches.length === 0 ? (
        <EmptyNotice>Nenhuma partida ao vivo no momento.</EmptyNotice>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <LiveCard key={match.matchId} match={match} />
          ))}
        </ul>
      )}
    </section>
  )
}
