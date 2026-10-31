'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { apiFetch } from '@/lib/api'
import {
  describeSlot,
  indexEntries,
  setsOf,
  slotLabel,
  type BracketEntry,
  type BracketMatch,
  type SetScore,
} from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'
import { MatchCard } from './match-card'

type StandingRow = {
  position: number
  registrationId: string
  played: number
  wins: number
  losses: number
  setsFor: number
  setsAgainst: number
  pointsFor: number
  pointsAgainst: number
}

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

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** Todos contra todos: classificação (vinda da API) e as partidas agrupadas por rodada. */
export function RoundRobinDraw({ drawId, matches, entries, results, categoryName, onSelectMatch, linkAthletes, live }: RoundRobinDrawProps) {
  const [rows, setRows] = useState<StandingRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refaz a busca quando uma partida ou um placar muda.
  const signature = useMemo(
    () =>
      matches.map((m) => `${m.id}:${m.status}`).join(',') +
      '|' +
      results.map((r) => `${r.matchId}:${r.setNumber}:${r.score1}-${r.score2}`).join(','),
    [matches, results],
  )

  useEffect(() => {
    let cancelled = false
    apiFetch<{ rows: StandingRow[] }>(`/draws/${drawId}/standings`)
      .then((res) => {
        if (cancelled) return
        setRows(res.rows)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido.')
      })
    return () => {
      cancelled = true
    }
  }, [drawId, signature])

  const entryIndex = useMemo(() => indexEntries(entries), [entries])
  const nameOf = (regId: string) => slotLabel(describeSlot(regId, entryIndex, false))

  const rounds = useMemo(() => {
    const byLabel = new Map<string, { order: number; items: BracketMatch[] }>()
    for (const m of matches) {
      const label = m.roundLabel ?? `Rodada ${m.round}`
      const group = byLabel.get(label) ?? { order: -m.round, items: [] }
      group.items.push(m)
      byLabel.set(label, group)
    }
    return [...byLabel.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([label, group]) => ({ label, items: [...group.items].sort((a, b) => a.position - b.position) }))
  }, [matches])

  if (matches.length === 0) return <EmptyNotice>Nenhuma partida nesta chave.</EmptyNotice>

  return (
    <div className="space-y-8 p-4">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Classificação
        </h3>
        {error && !rows ? (
          <ErrorNotice>Não foi possível carregar a classificação: {error}</ErrorNotice>
        ) : !rows ? (
          <p role="status" className="text-sm text-muted-foreground">Carregando classificação...</p>
        ) : (
          <div tabIndex={0} role="region" aria-label={`Classificação${categoryName ? ` de ${categoryName}` : ''}`} className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Classificação do todos contra todos: posição, participante, jogos, vitórias, derrotas e saldos de sets e de pontos.
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left">Pos.</th>
                  <th scope="col" className="px-3 py-2 text-left">Participante</th>
                  <th scope="col" className="px-3 py-2 text-right">J</th>
                  <th scope="col" className="px-3 py-2 text-right">V</th>
                  <th scope="col" className="px-3 py-2 text-right">D</th>
                  <th scope="col" className="px-3 py-2 text-right">Sets</th>
                  <th scope="col" className="px-3 py-2 text-right">Pontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.registrationId}>
                    <th scope="row" className="px-3 py-2 text-left font-semibold tabular-nums">{row.position}º</th>
                    <td className="px-3 py-2">{nameOf(row.registrationId)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.played}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.losses}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{signed(row.setsFor - row.setsAgainst)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{signed(row.pointsFor - row.pointsAgainst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rounds.map((round) => (
        <section key={round.label} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{round.label}</h3>
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
      ))}
    </div>
  )
}
