// Estatísticas de partidas de um atleta e confronto direto. Funções puras, sem banco.

export interface StatSet {
  score1: number
  score2: number
}

/** Uma partida encerrada vista do lado do atleta. */
export interface MatchRecord {
  /** Lado (1 ou 2) em que o atleta jogou. */
  side: 1 | 2
  sets: readonly StatSet[]
}

export interface StatsSummary {
  played: number
  wins: number
  losses: number
  /** Percentual de vitórias, 0 a 100, uma casa decimal. 0 sem partidas. */
  winRate: number
  setsWon: number
  setsLost: number
  pointsFor: number
  pointsAgainst: number
}

/** Lado vencedor lido dos sets; null quando os sets não decidem (sem sets ou empate). */
export function winnerSide(sets: readonly StatSet[]): 1 | 2 | null {
  const w1 = sets.filter((s) => s.score1 > s.score2).length
  const w2 = sets.filter((s) => s.score2 > s.score1).length
  return w1 > w2 ? 1 : w2 > w1 ? 2 : null
}

/** Resultado do atleta numa partida: 'W', 'L' ou null quando não dá para decidir. */
export function resultFor(record: MatchRecord): 'W' | 'L' | null {
  const winner = winnerSide(record.sets)
  if (winner === null) return null
  return winner === record.side ? 'W' : 'L'
}

export function summarize(records: readonly MatchRecord[]): StatsSummary {
  let wins = 0
  let losses = 0
  let setsWon = 0
  let setsLost = 0
  let pointsFor = 0
  let pointsAgainst = 0
  for (const record of records) {
    const result = resultFor(record)
    if (result === null) continue
    if (result === 'W') wins++
    else losses++
    for (const set of record.sets) {
      const own = record.side === 1 ? set.score1 : set.score2
      const other = record.side === 1 ? set.score2 : set.score1
      pointsFor += own
      pointsAgainst += other
      if (own > other) setsWon++
      else if (other > own) setsLost++
    }
  }
  const played = wins + losses
  return {
    played,
    wins,
    losses,
    winRate: played === 0 ? 0 : Math.round((wins / played) * 1000) / 10,
    setsWon,
    setsLost,
    pointsFor,
    pointsAgainst,
  }
}

/** Placar do ponto de vista do atleta: "21-15 18-21 21-19". */
export function scoreFor(record: MatchRecord): string {
  return record.sets
    .map((s) => (record.side === 1 ? `${s.score1}-${s.score2}` : `${s.score2}-${s.score1}`))
    .join(' ')
}

/** Maior sequência de vitórias seguidas, na ordem recebida (mais antiga primeiro). */
export function longestWinStreak(results: readonly ('W' | 'L' | null)[]): number {
  let best = 0
  let current = 0
  for (const result of results) {
    if (result === null) continue
    current = result === 'W' ? current + 1 : 0
    best = Math.max(best, current)
  }
  return best
}
