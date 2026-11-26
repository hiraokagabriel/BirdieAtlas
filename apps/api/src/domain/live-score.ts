// Placar ao vivo de badminton, derivado da sequência de pontos. A regra vem da categoria (`ScoringRule`:
// pontos do set, teto e sets para vencer; padrão 21 pontos, teto 30, melhor de 3). O placar nunca é
// gravado: é sempre recalculado da sequência de pontos.
import { DEFAULT_SCORING, setWinner as ruleSetWinner, type ScoringRule } from '@birdie-atlas/validators'

export type Side = 1 | 2

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
export function setWinner(score1: number, score2: number, rule: ScoringRule = DEFAULT_SCORING): Side | null {
  return ruleSetWinner(score1, score2, rule)
}

/** Recalcula o placar de uma sequência de pontos (cada item é quem marcou). */
export function computeLiveScore(points: readonly Side[], rule: ScoringRule = DEFAULT_SCORING): LiveScore {
  const sets: SetScore[] = []
  let cur: SetScore = { score1: 0, score2: 0 }
  let wins1 = 0
  let wins2 = 0

  for (const point of points) {
    if (wins1 >= rule.setsToWin || wins2 >= rule.setsToWin) break
    cur = point === 1 ? { ...cur, score1: cur.score1 + 1 } : { ...cur, score2: cur.score2 + 1 }

    const won = setWinner(cur.score1, cur.score2, rule)
    if (won) {
      sets.push(cur)
      if (won === 1) wins1++
      else wins2++
      cur = { score1: 0, score2: 0 }
    }
  }

  const winner: Side | null = wins1 >= rule.setsToWin ? 1 : wins2 >= rule.setsToWin ? 2 : null
  return {
    sets,
    currentSet: winner ? null : { setNumber: sets.length + 1, ...cur },
    setsWon: { side1: wins1, side2: wins2 },
    winner,
  }
}

/** Vale mais um ponto? Falso quando a partida já tem vencedor. */
export function canAddPoint(points: readonly Side[], rule: ScoringRule = DEFAULT_SCORING): boolean {
  return computeLiveScore(points, rule).winner === null
}

/** Sets encerrados no formato do resultado oficial (`match_results`). */
export function toResultSets(score: LiveScore): { setNumber: number; score1: number; score2: number }[] {
  return score.sets.map((s, index) => ({ setNumber: index + 1, score1: s.score1, score2: s.score2 }))
}
