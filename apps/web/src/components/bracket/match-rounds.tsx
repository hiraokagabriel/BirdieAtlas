import { indexEntries, setsOf, type BracketEntry, type BracketMatch, type SetScore } from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'
import { MatchCard } from './match-card'

/** Partidas agrupadas por rodada jogada (a de número mais alto é a primeira), cada rodada com seu título. */
export function MatchRounds({
  matches,
  entries,
  results,
  onSelectMatch,
  linkAthletes,
  live,
  /** Tira o prefixo do rótulo (ex.: "Grupo A · ") do título da rodada. */
  stripPrefix,
}: {
  matches: readonly BracketMatch[]
  entries: readonly BracketEntry[]
  results: readonly SetScore[]
  onSelectMatch?: ((match: BracketMatch) => void) | undefined
  linkAthletes?: boolean | undefined
  live?: ReadonlyMap<string, LiveMatch> | undefined
  stripPrefix?: string | undefined
}) {
  const entryIndex = indexEntries(entries)
  const byLabel = new Map<string, { order: number; items: BracketMatch[] }>()
  for (const m of matches) {
    const label = m.roundLabel ?? `Rodada ${m.round}`
    const group = byLabel.get(label) ?? { order: -m.round, items: [] }
    group.items.push(m)
    byLabel.set(label, group)
  }
  const rounds = [...byLabel.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([label, group]) => ({ label, items: [...group.items].sort((a, b) => a.position - b.position) }))

  return (
    <>
      {rounds.map((round) => {
        const title = stripPrefix && round.label.startsWith(stripPrefix) ? round.label.slice(stripPrefix.length) : round.label
        return (
          <section key={round.label} className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {round.items.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  title={round.label}
                  maxRound={-1}
                  entries={entryIndex}
                  sets={setsOf(match.id, results)}
                  onSelect={onSelectMatch}
                  linkAthletes={linkAthletes}
                  live={live?.get(match.id)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
