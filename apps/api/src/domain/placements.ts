// Colocação final de uma chave, derivada das partidas. Regra única: o motor de ranking e o
// encerramento do torneio usam esta função.

export interface PlacementMatch {
  id: string
  /** A rodada de número mais alto é a primeira fase; a rodada 1 é a final. */
  round: number
  registration1Id: string | null
  registration2Id: string | null
}

export interface PlacementSet {
  score1: number
  score2: number
}

function winnerSlotFromSets(sets: PlacementSet[]): 1 | 2 | null {
  if (!sets.length) return null
  const w1 = sets.filter((s) => s.score1 > s.score2).length
  const w2 = sets.filter((s) => s.score2 > s.score1).length
  return w1 > w2 ? 1 : w2 > w1 ? 2 : null
}

/** Vencedor e perdedor de uma partida; null quando não dá para decidir. */
function resolveWinnerLoser(
  match: PlacementMatch,
  sets: PlacementSet[],
): { winnerRegId: string; loserRegId: string | null } | null {
  const { registration1Id, registration2Id } = match

  // Bye: um lado é null, o lado presente avança
  if (registration2Id === null && registration1Id !== null) return { winnerRegId: registration1Id, loserRegId: null }
  if (registration1Id === null && registration2Id !== null) return { winnerRegId: registration2Id, loserRegId: null }
  if (!registration1Id || !registration2Id) return null

  const slot = winnerSlotFromSets(sets)
  if (!slot) return null
  return {
    winnerRegId: slot === 1 ? registration1Id : registration2Id,
    loserRegId: slot === 1 ? registration2Id : registration1Id,
  }
}

/**
 * Colocação por inscrição: vencedor da final = 1º; perdedor da rodada `r` = 2º na final e
 * `2^(r-1) + 1` nas demais (3º nas semifinais, 5º nas quartas, 9º nas oitavas).
 */
export function computePlacements(
  matches: PlacementMatch[],
  setsByMatchId: Map<string, PlacementSet[]>,
): Map<string, number> {
  // O chamador é responsável por só chamar com todas as partidas da chave encerradas.
  const placementByReg = new Map<string, number>()

  for (const match of matches) {
    if (match.registration1Id === null && match.registration2Id === null) continue

    const result = resolveWinnerLoser(match, setsByMatchId.get(match.id) ?? [])
    if (!result) continue

    const { winnerRegId, loserRegId } = result
    const loserPlacement = match.round === 1 ? 2 : Math.pow(2, match.round - 1) + 1
    if (loserRegId) placementByReg.set(loserRegId, loserPlacement)
    if (match.round === 1) placementByReg.set(winnerRegId, 1)
  }

  return placementByReg
}
