'use client'

import { useMemo } from 'react'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { describeSlot, indexEntries, slotLabel, type BracketEntry, type BracketMatch, type SetScore } from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'
import { MatchRounds } from './match-rounds'
import { StandingsTable } from './standings-table'
import { useStandings } from './use-standings'

export type RoundRobinDrawProps = {
  drawId: string
  matches: readonly BracketMatch[]
  entries: readonly BracketEntry[]
  results: readonly SetScore[]
  categoryName?: string
  onSelectMatch?: (match: BracketMatch) => void
  linkAthletes?: boolean
  live?: ReadonlyMap<string, LiveMatch>
}

/** Todos contra todos: classificação (vinda da API) e as partidas agrupadas por rodada. */
export function RoundRobinDraw({ drawId, matches, entries, results, categoryName, onSelectMatch, linkAthletes, live }: RoundRobinDrawProps) {
  const { data, error } = useStandings(drawId, matches, results)
  const entryIndex = useMemo(() => indexEntries(entries), [entries])
  const nameOf = (regId: string) => slotLabel(describeSlot(regId, entryIndex, false))

  if (matches.length === 0) return <EmptyNotice>Nenhuma partida nesta chave.</EmptyNotice>

  return (
    <div className="space-y-8 p-4">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Classificação</h3>
        {error && !data ? (
          <ErrorNotice>Não foi possível carregar a classificação: {error}</ErrorNotice>
        ) : !data ? (
          <p role="status" className="text-sm text-muted-foreground">Carregando classificação...</p>
        ) : (
          <StandingsTable rows={data.rows} nameOf={nameOf} label={`Classificação${categoryName ? ` de ${categoryName}` : ''}`} />
        )}
      </section>

      <MatchRounds matches={matches} entries={entries} results={results} onSelectMatch={onSelectMatch} linkAthletes={linkAthletes} live={live} />
    </div>
  )
}
