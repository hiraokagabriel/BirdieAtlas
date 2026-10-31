'use client'

import { BracketTree } from './bracket-tree'
import { MatchRounds } from './match-rounds'
import { EmptyNotice } from '@/components/public/notices'
import { type BracketEntry, type BracketMatch, type SetScore } from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'

export type DoubleEliminationDrawProps = {
  matches: readonly BracketMatch[]
  entries: readonly BracketEntry[]
  results: readonly SetScore[]
  categoryName?: string | undefined
  onSelectMatch?: ((match: BracketMatch) => void) | undefined
  linkAthletes?: boolean | undefined
  live?: ReadonlyMap<string, LiveMatch> | undefined
}

/** Eliminação dupla: chave dos vencedores (árvore), chave dos perdedores (por rodada) e a grande final. */
export function DoubleEliminationDraw({ matches, entries, results, categoryName, onSelectMatch, linkAthletes, live }: DoubleEliminationDrawProps) {
  if (matches.length === 0) return <EmptyNotice>Nenhuma partida nesta chave.</EmptyNotice>

  const winners = matches.filter((m) => m.stage === 'winners')
  const losers = matches.filter((m) => m.stage === 'losers')
  const grandFinal = matches.filter((m) => m.stage === 'grand_final')
  const reset = matches.find((m) => m.stage === 'grand_final_reset')
  const resetActive = !!reset && reset.registration1Id !== null && reset.registration2Id !== null

  return (
    <div className="space-y-10 p-4">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Chave dos vencedores</h3>
        <BracketTree
          matches={winners}
          entries={entries}
          results={results}
          categoryName={categoryName ? `${categoryName} (vencedores)` : 'vencedores'}
          onSelectMatch={onSelectMatch}
          linkAthletes={linkAthletes}
          live={live}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Chave dos perdedores</h3>
        {losers.length === 0 ? (
          <EmptyNotice>Sem partidas na chave dos perdedores.</EmptyNotice>
        ) : (
          <MatchRounds matches={losers} entries={entries} results={results} onSelectMatch={onSelectMatch} linkAthletes={linkAthletes} live={live} />
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Grande final</h3>
        <MatchRounds
          matches={[...grandFinal, ...(resetActive && reset ? [reset] : [])]}
          entries={entries}
          results={results}
          onSelectMatch={onSelectMatch}
          linkAthletes={linkAthletes}
          live={live}
        />
        {reset && !resetActive && (
          <p className="text-sm text-muted-foreground">
            Há reset: se quem veio da chave dos perdedores vencer a grande final, os dois jogam de novo.
          </p>
        )}
      </section>
    </div>
  )
}
