import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { ROWS } from '@/components/public/rows'
import { Skeleton } from '@/components/ui/skeleton'
import { CONNECTION_LABEL, formatLiveScore, liveTitle, type LiveConnection, type LiveMatch } from '@/lib/live'
import { LiveScoreGrid } from './live-score-grid'
import type { LiveMatchesState } from './use-live-matches'

const CONNECTION_STYLE: Record<LiveConnection, { text: string; dot: string }> = {
  connecting: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  live: { text: 'text-success', dot: 'bg-success motion-safe:animate-pulse' },
  reconnecting: { text: 'text-warning', dot: 'bg-warning motion-safe:animate-pulse' },
  polling: { text: 'text-info', dot: 'bg-info' },
}

/** Estado da conexão, sempre visível: o público precisa saber se o placar está chegando. */
export function ConnectionBadge({ connection, className }: { connection: LiveConnection; className?: string }) {
  const style = CONNECTION_STYLE[connection]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', style.text, className)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', style.dot)} />
      {CONNECTION_LABEL[connection]}
    </span>
  )
}

function LiveCard({ match }: { match: LiveMatch }) {
  const court = match.courtNumber != null ? `Quadra ${match.courtNumber}` : 'Sem quadra'
  const label = `${court}, ${match.categoryName}, ${match.roundLabel}: ${liveTitle(match)}, placar ${formatLiveScore(match) || 'zero a zero'}`
  return (
    <li>
      <article aria-labelledby={`live-${match.matchId}`} className="px-4 py-3">
        {/* Texto real (não só aria-label): leitores de tela no modo de leitura não leem o nome do article. */}
        <p id={`live-${match.matchId}`} className="sr-only">{label}</p>
        <LiveScoreGrid match={match} caption={`${match.categoryName} · ${match.roundLabel}`} />
        {match.winner && <p className="mt-2 text-xs font-medium text-muted-foreground">Fim de jogo, aguardando confirmação da mesa</p>}
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
        <h2 id="live-now-title" className="font-heading text-2xl font-bold leading-tight">
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
        <div role="status" aria-label="Carregando partidas ao vivo" className={cn(ROWS, 'grid sm:grid-cols-2 sm:divide-y-0')}>
          <Skeleton className="m-3 h-20" />
          <Skeleton className="m-3 hidden h-20 sm:block" />
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
        <ul className={ROWS}>
          {matches.map((match) => (
            <LiveCard key={match.matchId} match={match} />
          ))}
        </ul>
      )}
    </section>
  )
}
