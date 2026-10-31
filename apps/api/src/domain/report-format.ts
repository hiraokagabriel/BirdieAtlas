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
