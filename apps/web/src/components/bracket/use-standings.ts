'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { BracketMatch, SetScore } from '@/lib/bracket'
import type { StandingRow } from './standings-table'

export type GroupStandings = { key: string; rows: StandingRow[] }
type StandingsResponse = { rows: StandingRow[]; groups: GroupStandings[] }

/** Busca `GET /draws/:drawId/standings` e refaz a busca quando uma partida ou um placar muda. */
export function useStandings(drawId: string, matches: readonly BracketMatch[], results: readonly SetScore[]) {
  const [data, setData] = useState<StandingsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const signature = useMemo(
    () =>
      matches.map((m) => `${m.id}:${m.status}`).join(',') +
      '|' +
      results.map((r) => `${r.matchId}:${r.setNumber}:${r.score1}-${r.score2}`).join(','),
    [matches, results],
  )

  useEffect(() => {
    let cancelled = false
    apiFetch<StandingsResponse>(`/draws/${drawId}/standings`)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido.')
      })
    return () => {
      cancelled = true
    }
  }, [drawId, signature])

  return { data, error }
}
