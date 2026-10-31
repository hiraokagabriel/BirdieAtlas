// Formatação das exportações de relatório (resultados e classificação). Funções puras.

/** Na chave, a rodada 1 é a final e a de número mais alto é a primeira fase. */
export function roundLabel(round: number): string {
  if (round === 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas de final'
  return `Rodada ${round}`
}

export function formatScore(sets: { score1: number; score2: number }[]): string {
  return sets.map((s) => `${s.score1}-${s.score2}`).join(' ')
}

export const MATCH_STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  walkover: 'W.O.',
  retired: 'Desistência',
} as const

export const GENDER_LABELS = { M: 'Masculino', F: 'Feminino' } as const

/** Primeira fase primeiro (rodada de número mais alto); a final fica por último. */
export function sortMatchesForReport<T extends { round: number; position: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => b.round - a.round || a.position - b.position)
}

/** Vencedor a partir do lado (1 ou 2) que os sets definem; sem sets decisivos (W.O., bye) não há vencedor. */
export function pickWinner(slot: 1 | 2 | null, side1: string | null, side2: string | null): string | null {
  return slot === 1 ? side1 : slot === 2 ? side2 : null
}

/** Clubes dos atletas da inscrição, sem repetir, separados por " / ". */
export function joinClubs(clubNames: readonly (string | undefined)[]): string {
  return [...new Set(clubNames.filter((v): v is string => !!v))].join(' / ')
}

/** Ordem da classificação: colocação e, no empate, o id (estável). */
export function sortByPlacement<T extends { finalPlacement: number | null; id: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.finalPlacement ?? 0) - (b.finalPlacement ?? 0) || a.id.localeCompare(b.id))
}
