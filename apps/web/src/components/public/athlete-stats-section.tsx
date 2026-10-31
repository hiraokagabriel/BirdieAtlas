import Link from 'next/link'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { StatTile } from '@/components/public/stat-tile'
import { cn } from '@/lib/utils'
import type { AthleteStats, StatsSummary } from '@/lib/public-athlete'

const percent = (value: number) => `${String(value).replace('.', ',')}%`

export function ResultChip({ result }: { result: 'W' | 'L' | null }) {
  if (result === null) return null
  return (
    <span
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
        result === 'W' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
      )}
    >
      <span aria-hidden="true">{result === 'W' ? 'V' : 'D'}</span>
      <span className="sr-only">{result === 'W' ? 'Vitória' : 'Derrota'}</span>
    </span>
  )
}

export function SummaryTiles({ summary, extra }: { summary: StatsSummary; extra?: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label="Partidas" value={summary.played} />
      <StatTile label="Vitórias" value={summary.wins} hint={`${summary.losses} derrota${summary.losses === 1 ? '' : 's'}`} highlight={summary.wins > 0} />
      <StatTile label="Aproveitamento" value={percent(summary.winRate)} />
      <StatTile label="Sets" value={`${summary.setsWon}-${summary.setsLost}`} hint="ganhos e perdidos" />
      {extra}
    </dl>
  )
}

/** Seção "Partidas" do perfil: números gerais e as últimas cinco partidas. `stats` nulo = a API falhou. */
export function AthleteStatsSection({ stats }: { stats: AthleteStats | null }) {
  return (
    <section aria-labelledby="matches-title" className="space-y-4">
      <h2 id="matches-title" className="text-2xl">
        Partidas
      </h2>
      {stats === null ? (
        <ErrorNotice>Não foi possível carregar as estatísticas de partidas agora.</ErrorNotice>
      ) : stats.summary.played === 0 ? (
        <EmptyNotice>Nenhuma partida encerrada para este atleta ainda.</EmptyNotice>
      ) : (
        <>
          <SummaryTiles
            summary={stats.summary}
            extra={<StatTile label="Maior sequência" value={stats.longestWinStreak} hint="vitórias seguidas" />}
          />
          <h3 className="text-lg">Últimas partidas</h3>
          <ul className="space-y-2">
            {stats.recent.map((m) => (
              <li key={m.matchId} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <ResultChip result={m.result} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    contra{' '}
                    {m.opponents.map((o, i) => (
                      <span key={o.id}>
                        {i > 0 && ' / '}
                        <Link
                          href={`/a/${o.id}`}
                          className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {o.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <Link
                      href={`/t/${m.tournamentSlug}`}
                      className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {m.tournamentName}
                    </Link>
                    {' · '}
                    {m.categoryName} · {m.roundLabel}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{m.score}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
