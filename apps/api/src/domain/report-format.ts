// Formatação das exportações de relatório (resultados e classificação). Funções puras.

// O nome da fase pela rodada (Final, Semifinal...) vive em schedule.ts; a exportação usa o mesmo.
export { roundLabel, matchRoundLabel } from './schedule.js'

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

/** Fuso das exportações: o produto atende a federação paulista, então o horário sai em Brasília. */
export const REPORT_TIME_ZONE = 'America/Sao_Paulo'

const reportDateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: REPORT_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** "27/10/2026 14:30", no horário de Brasília. */
export function formatReportDateTime(date: Date): string {
  const p = Object.fromEntries(reportDateTime.formatToParts(date).map((part) => [part.type, part.value]))
  return `${p['day']}/${p['month']}/${p['year']} ${p['hour']}:${p['minute']}`
}

/** Coluna `date` ("2026-03-15") vira "15/03/2026". */
export function formatReportDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return year && month && day ? `${day}/${month}/${year}` : isoDate
}

/** Agenda: por horário, depois quadra (sem quadra por último) e ordem da chave. */
export function sortScheduleForReport<T extends { scheduledAt: Date; courtNumber: number | null; round: number; position: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    a.scheduledAt.getTime() - b.scheduledAt.getTime()
    || (a.courtNumber ?? Number.MAX_SAFE_INTEGER) - (b.courtNumber ?? Number.MAX_SAFE_INTEGER)
    || b.round - a.round || a.position - b.position)
}
