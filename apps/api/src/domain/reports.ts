import type { CsvCell } from './csv.js'
import { winnerSlotFromSets, type PlacementSet } from './placements.js'
import { roundLabel } from './schedule.js'

// Linhas dos relatórios CSV. Funções puras: a rota carrega os dados e o `buildCsv` formata.
// Só nomes, clube e dados esportivos: nunca e-mail, CPF, telefone, nascimento nem `notes`.

type Row = CsvCell[]

export const MATCH_STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Encerrada',
  walkover: 'W.O.',
  retired: 'Desistência',
} as const

export type MatchStatus = keyof typeof MATCH_STATUS_LABELS

/** Fuso das exportações: o produto atende a federação paulista, então o horário sai em Brasília. */
export const REPORT_TIME_ZONE = 'America/Sao_Paulo'

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: REPORT_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "27/10/2026 14:30" (Brasília). */
export function formatReportDateTime(date: Date): string {
  const parts = Object.fromEntries(dateTimeFormat.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts['day']}/${parts['month']}/${parts['year']} ${parts['hour']}:${parts['minute']}`
}

/** "2026-03-15" (coluna `date`) vira "15/03/2026". */
export function formatReportDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return year && month && day ? `${day}/${month}/${year}` : isoDate
}

/** "6-4 3-6 7-5", na ordem dos sets. */
export function formatSets(sets: readonly (PlacementSet & { setNumber: number })[]): string {
  return [...sets].sort((a, b) => a.setNumber - b.setNumber).map((s) => `${s.score1}-${s.score2}`).join(' ')
}

export interface ReportMatch {
  categoryName: string
  round: number
  position: number
  participant1: string | null
  participant2: string | null
  status: MatchStatus
  sets: readonly (PlacementSet & { setNumber: number })[]
  scheduledAt: Date | null
  courtNumber: number | null
}

/** Vencedor pelos sets; numa partida com um lado só (bye), o lado presente. */
function winnerName(match: ReportMatch): string {
  if (match.participant1 === null && match.participant2 !== null) return match.participant2
  if (match.participant2 === null && match.participant1 !== null) return match.participant1
  const slot = winnerSlotFromSets(match.sets)
  if (slot === 1) return match.participant1 ?? ''
  if (slot === 2) return match.participant2 ?? ''
  return ''
}

/** Da primeira fase para a final (rodada de número mais alto primeiro), como a chave é lida. */
function byBracketOrder(a: ReportMatch, b: ReportMatch): number {
  return a.categoryName.localeCompare(b.categoryName, 'pt-BR') || b.round - a.round || a.position - b.position
}

const hasParticipant = (m: ReportMatch) => m.participant1 !== null || m.participant2 !== null

export const RESULTS_HEADER = ['Categoria', 'Fase', 'Partida', 'Atleta 1', 'Atleta 2', 'Placar', 'Vencedor', 'Status']

/** Uma linha por partida com ao menos um participante, na ordem da chave. */
export function resultsRows(matches: readonly ReportMatch[]): Row[] {
  return matches.filter(hasParticipant).sort(byBracketOrder).map((m) => [
    m.categoryName,
    roundLabel(m.round),
    m.position,
    m.participant1 ?? '',
    m.participant2 ?? '',
    formatSets(m.sets),
    winnerName(m),
    MATCH_STATUS_LABELS[m.status],
  ])
}

export const SCHEDULE_HEADER = ['Quadra', 'Horário', 'Categoria', 'Fase', 'Atleta 1', 'Atleta 2', 'Status']

/** Partidas com quadra e horário, por horário e depois quadra. */
export function scheduleRows(matches: readonly ReportMatch[]): Row[] {
  return matches
    .filter((m): m is ReportMatch & { scheduledAt: Date } => m.scheduledAt !== null && hasParticipant(m))
    .sort((a, b) =>
      a.scheduledAt.getTime() - b.scheduledAt.getTime()
      || (a.courtNumber ?? 0) - (b.courtNumber ?? 0)
      || byBracketOrder(a, b))
    .map((m) => [
      m.courtNumber,
      formatReportDateTime(m.scheduledAt),
      m.categoryName,
      roundLabel(m.round),
      m.participant1 ?? '',
      m.participant2 ?? '',
      MATCH_STATUS_LABELS[m.status],
    ])
}

export interface ReportPlacement {
  categoryName: string
  placement: number
  athlete: string
  partner: string | null
  club: string
}

export const PODIUM_HEADER = ['Categoria', 'Colocação', 'Atleta', 'Parceiro(a)', 'Clube']

export function podiumRows(placements: readonly ReportPlacement[]): Row[] {
  return [...placements]
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'pt-BR') || a.placement - b.placement || a.athlete.localeCompare(b.athlete, 'pt-BR'))
    .map((p) => [p.categoryName, p.placement, p.athlete, p.partner ?? '', p.club])
}

export interface ReportAffiliation {
  clubName: string
  athlete: string
  startedAt: string
}

export const CLUB_ATHLETES_HEADER = ['Clube', 'Atleta', 'Afiliado desde']

export function clubAthletesRows(affiliations: readonly ReportAffiliation[]): Row[] {
  return [...affiliations]
    .sort((a, b) => a.athlete.localeCompare(b.athlete, 'pt-BR'))
    .map((a) => [a.clubName, a.athlete, formatReportDate(a.startedAt)])
}
