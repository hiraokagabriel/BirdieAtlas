// Ordem da classificação do ranking. Funções puras, sem banco.
//
// Critérios, nesta ordem (o primeiro que diferenciar decide):
//   1. mais pontos totais;
//   2. mais títulos (1º lugar) entre os resultados que contam;
//   3. mais 2º lugares;
//   4. mais 3º lugares;
//   5. maior pontuação individual num torneio;
//   6. menos torneios jogados (mesmos pontos com menos participações = melhor aproveitamento);
//   7. id do atleta (só para a ordem ser estável entre recálculos).
// Empate total não existe: cada atleta (ou dupla) ocupa uma posição própria.

export interface RankingResult {
  points: number
  placement: number
}

export interface RankableEntry {
  athleteId: string
  athlete2Id: string | null
  totalPoints: number
  tournamentsCount: number
  /** Os resultados que entram na soma (já cortados por `countBestResults`). */
  counted: readonly RankingResult[]
}

function countPlacement(results: readonly RankingResult[], placement: number): number {
  return results.filter((r) => r.placement === placement).length
}

function bestSingle(results: readonly RankingResult[]): number {
  return results.reduce((max, r) => Math.max(max, r.points), 0)
}

export function compareRankingEntries(a: RankableEntry, b: RankableEntry): number {
  return (
    b.totalPoints - a.totalPoints ||
    countPlacement(b.counted, 1) - countPlacement(a.counted, 1) ||
    countPlacement(b.counted, 2) - countPlacement(a.counted, 2) ||
    countPlacement(b.counted, 3) - countPlacement(a.counted, 3) ||
    bestSingle(b.counted) - bestSingle(a.counted) ||
    a.tournamentsCount - b.tournamentsCount ||
    a.athleteId.localeCompare(b.athleteId) ||
    (a.athlete2Id ?? '').localeCompare(b.athlete2Id ?? '')
  )
}

export function sortRankingEntries<T extends RankableEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(compareRankingEntries)
}
