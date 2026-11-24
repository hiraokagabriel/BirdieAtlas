import Link from 'next/link'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { INLINE_LINK, ROWS } from '@/components/public/rows'
import { STAT_GRID, StatTile } from '@/components/public/stat-tile'
import { cn } from '@/lib/utils'
import type { AthleteStats, StatsSummary } from '@/lib/public-athlete'

const percent = (value: number) => `${String(value).replace('.', ',')}%`

export function ResultChip({ result }: { result: 'W' | 'L' | null }) {
  if (result === null) return null
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-sm font-heading text-sm font-bold',
        result === 'W' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      <span aria-hidden="true">{result === 'W' ? 'V' : 'D'}</span>
      <span className="sr-only">{result === 'W' ? 'Vitória' : 'Derrota'}</span>
    </span>
  )
}

export function SummaryTiles({ summary, extra }: { summary: StatsSummary; extra?: React.ReactNode }) {
  return (
    <dl className={STAT_GRID}>
      <StatTile label="Partidas" value={summary.played} />
      <StatTile label="Vitórias" value={summary.wins} hint={`${summary.losses} derrota${summary.losses === 1 ? '' : 's'}`} />
      <StatTile label="Aproveitamento" value={percent(summary.winRate)} />
      <StatTile label="Sets" value={`${summary.setsWon}-${summary.setsLost}`} hint="ganhos e perdidos" />
      {extra}
    </dl>
  )
}

/** Seção "Partidas" do perfil: números gerais e as últimas cinco partidas. `stats` nulo = a API falhou. */
export function AthleteStatsSection({ stats }: { stats: AthleteStats | null }) {
  return (
    <section aria-labelledby="matches-title" className="space-y-3">
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
          <h3 className="pt-3 text-lg">Últimas partidas</h3>
          <ul className={ROWS}>
            {stats.recent.map((m) => (
              <li key={m.matchId} className="flex min-h-14 items-center gap-3 px-4 pb-3 pt-1">
                <ResultChip result={m.result} />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">
                    <span className="font-normal text-muted-foreground">x </span>
                    {m.opponents.map((o, i) => (
                      <span key={o.id}>
                        {i > 0 && ' / '}
                        <Link href={`/a/${o.id}`} className={`inline-flex min-h-11 items-center ${INLINE_LINK}`}>
                          {o.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    <Link href={`/t/${m.tournamentSlug}`} className={INLINE_LINK}>
                      {m.tournamentName}
                    </Link>
                    {' · '}
                    {m.categoryName} · {m.roundLabel}
                  </p>
                </div>
                <p className="shrink-0 font-heading text-base font-bold tabular-nums">{m.score}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
