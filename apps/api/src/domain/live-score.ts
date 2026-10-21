// Placar ao vivo de badminton, derivado da sequência de pontos. Regra única do placar provisório:
// set até 21 pontos com diferença de 2, limite de 30 (aos 29-29 o ponto seguinte decide),
// melhor de 3 sets. O placar nunca é gravado: é sempre recalculado da sequência de pontos.

export type Side = 1 | 2

export const POINTS_TO_WIN_SET = 21
export const MIN_LEAD = 2
export const SET_POINT_CAP = 30
export const SETS_TO_WIN_MATCH = 2

export interface SetScore {
  score1: number
  score2: number
}

export interface LiveScore {
  /** Sets já encerrados, em ordem. */
  sets: SetScore[]
  /** Set em disputa; `null` quando a partida já tem vencedor. */
  currentSet: (SetScore & { setNumber: number }) | null
  setsWon: { side1: number; side2: number }
  /** Vencedor da partida; `null` enquanto ela está aberta. */
  winner: Side | null
}

/** Quem venceu o set com este placar, ou `null` se ainda está aberto. */
export function setWinner(score1: number, score2: number): Side | null {
  if (score1 >= SET_POINT_CAP) return 1
  if (score2 >= SET_POINT_CAP) return 2
  if (score1 >= POINTS_TO_WIN_SET && score1 - score2 >= MIN_LEAD) return 1
  if (score2 >= POINTS_TO_WIN_SET && score2 - score1 >= MIN_LEAD) return 2
  return null
}

/** Recalcula o placar de uma sequência de pontos (cada item é quem marcou). */
export function computeLiveScore(points: readonly Side[]): LiveScore {
  const sets: SetScore[] = []
  let cur: SetScore = { score1: 0, score2: 0 }
  let wins1 = 0
  let wins2 = 0

  for (const point of points) {
    if (wins1 >= SETS_TO_WIN_MATCH || wins2 >= SETS_TO_WIN_MATCH) break
    cur = point === 1 ? { ...cur, score1: cur.score1 + 1 } : { ...cur, score2: cur.score2 + 1 }

    const won = setWinner(cur.score1, cur.score2)
    if (won) {
      sets.push(cur)
      if (won === 1) wins1++
      else wins2++
      cur = { score1: 0, score2: 0 }
    }
  }

  const winner: Side | null = wins1 >= SETS_TO_WIN_MATCH ? 1 : wins2 >= SETS_TO_WIN_MATCH ? 2 : null
  return {
    sets,
    currentSet: winner ? null : { setNumber: sets.length + 1, ...cur },
    setsWon: { side1: wins1, side2: wins2 },
    winner,
  }
}

/** Vale mais um ponto? Falso quando a partida já tem vencedor. */
export function canAddPoint(points: readonly Side[]): boolean {
  return computeLiveScore(points).winner === null
}

/** Sets encerrados no formato do resultado oficial (`match_results`). */
export function toResultSets(score: LiveScore): { setNumber: number; score1: number; score2: number }[] {
  return score.sets.map((s, index) => ({ setNumber: index + 1, score1: s.score1, score2: s.score2 }))
}
