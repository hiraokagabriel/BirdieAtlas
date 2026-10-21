import Link from 'next/link'
import { PlacementBadge } from '@/components/public/placement-badge'
import { EmptyNotice } from '@/components/public/notices'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  buildRounds,
  computePodium,
  describeSlot,
  indexEntries,
  setsOf,
  type BracketEntry,
  type BracketMatch,
  type SetScore,
  type SlotView,
} from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'
import { MatchCard } from './match-card'

export type BracketTreeProps = {
  matches: readonly BracketMatch[]
  entries: readonly BracketEntry[]
  results: readonly SetScore[]
  /** Nome da categoria, usado no rótulo acessível da região. */
  categoryName?: string
  /** Admin: abre o diálogo de resultado ao ativar um cartão. */
  onSelectMatch?: (match: BracketMatch) => void
  /** Público: nomes viram links para /a/<id>. */
  linkAthletes?: boolean
  /** Placar ao vivo por id da partida: cartões das partidas em andamento mostram o placar corrente. */
  live?: ReadonlyMap<string, LiveMatch>
}

// Altura mínima de cada célula da primeira fase. As rodadas seguintes dividem a mesma altura total,
// então cada partida fica centralizada entre as duas que a alimentam.
const CELL_MIN_HEIGHT = 'min-h-[8rem]'

const LINE = 'absolute bg-foreground/25'

/** Conector entre a rodada e a seguinte: cotovelo que une a partida ímpar à par. */
function Connector({ position }: { position: number }) {
  const isTop = position % 2 === 1
  return (
    <span aria-hidden="true" className="relative w-8 shrink-0 self-stretch">
      <span className={cn(LINE, 'left-0 top-1/2 h-px w-1/2 -translate-y-1/2')} />
      <span className={cn(LINE, 'left-1/2 w-px -translate-x-1/2', isTop ? 'bottom-0 top-1/2' : 'bottom-1/2 top-0')} />
      {isTop && <span className={cn(LINE, 'bottom-0 left-1/2 h-px w-1/2 translate-y-1/2')} />}
    </span>
  )
}

function ChampionName({ slot, link }: { slot: SlotView; link: boolean }) {
  if (slot.kind !== 'athlete') return null
  return (
    <>
      {slot.athletes.map((athlete, index) => (
        <span key={`${athlete.id}-${index}`}>
          {index > 0 && ' / '}
          {link && athlete.id ? (
            <Link href={`/a/${athlete.id}`} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {athlete.name}
            </Link>
          ) : (
            athlete.name
          )}
        </span>
      ))}
    </>
  )
}

function ChampionCallout({
  champion,
  runnerUp,
  link,
}: {
  champion: SlotView
  runnerUp: SlotView | null
  link: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-medal-gold bg-card p-3 shadow-sm">
      <PlacementBadge placement={1} className="size-11 text-lg" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campeão</p>
        <p className="font-heading text-xl font-bold leading-tight">
          <ChampionName slot={champion} link={link} />
        </p>
        {runnerUp && runnerUp.kind === 'athlete' && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vice: <ChampionName slot={runnerUp} link={link} />
          </p>
        )}
      </div>
    </div>
  )
}

export function BracketSkeleton() {
  return (
    <div role="status" aria-label="Carregando chave" className="flex gap-8 overflow-hidden p-4">
      {[4, 2, 1].map((count) => (
        <div key={count} className="flex w-64 shrink-0 flex-col gap-4">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ))}
      <span className="sr-only">Carregando chave…</span>
    </div>
  )
}

export function BracketTree({
  matches,
  entries,
  results,
  categoryName,
  onSelectMatch,
  linkAthletes = false,
  live,
}: BracketTreeProps) {
  if (matches.length === 0) return <EmptyNotice>Chave ainda não sorteada.</EmptyNotice>

  const rounds = buildRounds(matches)
  const maxRound = rounds[0].round
  const entryMap = indexEntries(entries)
  const podium = computePodium(matches, results)
  const champion = podium ? describeSlot(podium.champion, entryMap, false) : null
  const runnerUp = podium?.runnerUp ? describeSlot(podium.runnerUp, entryMap, false) : null

  return (
    <div className="space-y-3">
      {champion && <ChampionCallout champion={champion} runnerUp={runnerUp} link={linkAthletes} />}

      <div
        role="region"
        aria-label={categoryName ? `Chave de ${categoryName}` : 'Chave'}
        tabIndex={0}
        className={cn(
          'relative max-h-[80vh] max-w-full snap-x snap-mandatory overflow-auto overscroll-x-contain rounded-xl border border-border bg-card md:snap-proximity',
          'scroll-pl-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
        )}
      >
        <div data-print-fit="" className="flex w-max min-w-full px-4 pb-4">
          {rounds.map(({ round, title, matches: roundMatches }) => (
            <section
              key={round}
              aria-label={title}
              className="flex w-[17.5rem] shrink-0 snap-start flex-col max-[420px]:w-[85vw]"
            >
              <h3 className="sticky top-0 z-10 bg-card py-3 text-center font-heading text-sm uppercase tracking-wider text-muted-foreground">
                {title}
              </h3>
              <ol className="flex flex-1 flex-col">
                {roundMatches.map((match) => (
                  <li key={match.id} className={cn('flex flex-1 items-center', CELL_MIN_HEIGHT)}>
                    <div className="my-2 min-w-0 flex-1">
                      <MatchCard
                        match={match}
                        title={title}
                        maxRound={maxRound}
                        entries={entryMap}
                        sets={setsOf(match.id, results)}
                        onSelect={onSelectMatch}
                        linkAthletes={linkAthletes}
                        live={live?.get(match.id)}
                      />
                    </div>
                    {round > 1 && <Connector position={match.position} />}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
