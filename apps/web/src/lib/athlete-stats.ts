export interface HistoryEntryLike {
  tournamentId: string
  finalPlacement: number | null
}

export interface RankingPositionLike {
  position: number | null
}

export interface AthleteSummary {
  tournaments: number
  titles: number
  podiums: number
  bestRankingPosition: number | null
}

/** Colocação 1 a 3 conta como pódio; `null` (torneio sem resultado) não conta. */
export function isPodium(placement: number | null): placement is 1 | 2 | 3 {
  return placement === 1 || placement === 2 || placement === 3
}

export function summarizeAthlete(
  history: readonly HistoryEntryLike[],
  rankingPositions: readonly RankingPositionLike[],
): AthleteSummary {
  const positions = rankingPositions.flatMap((r) => (r.position === null ? [] : [r.position]))
  return {
    tournaments: new Set(history.map((h) => h.tournamentId)).size,
    titles: history.filter((h) => h.finalPlacement === 1).length,
    podiums: history.filter((h) => isPodium(h.finalPlacement)).length,
    bestRankingPosition: positions.length ? Math.min(...positions) : null,
  }
}
