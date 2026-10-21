// Apoio da agenda automática: validação do formulário, corpo da requisição e agrupamento da
// proposta por dia e quadra. Funções puras, testadas em auto-schedule.test.ts.

export interface AutoScheduleForm {
  courts: string
  /** Valor de `datetime-local`: "YYYY-MM-DDTHH:mm", no fuso do navegador. */
  startAt: string
  matchMinutes: string
  restMinutes: string
  reschedule: boolean
}

export type AutoScheduleField = 'courts' | 'startAt' | 'matchMinutes' | 'restMinutes'
export type AutoScheduleFormErrors = Partial<Record<AutoScheduleField, string>>

export interface AutoScheduleRequest {
  courts: number
  startAt: string
  matchMinutes: number
  restMinutes: number
  reschedule: boolean
  dryRun: boolean
}

export interface AutoScheduleItem {
  matchId: string
  categoryId: string
  categoryName: string
  discipline: string
  round: number
  roundLabel: string
  position: number
  participant1: string | null
  participant2: string | null
}

export interface AutoScheduleAssignment extends AutoScheduleItem {
  courtNumber: number
  /** ISO em UTC. */
  scheduledAt: string
}

export interface AutoScheduleUnscheduled extends AutoScheduleItem {
  reason: string
}

export interface AutoScheduleResponse {
  dryRun: boolean
  applied: boolean
  summary: { planned: number; unscheduled: number }
  assignments: AutoScheduleAssignment[]
  unscheduled: AutoScheduleUnscheduled[]
  warnings: string[]
}

const INTEGER = /^\d+$/

function checkInteger(value: string, min: number, max: number, label: string): string | undefined {
  const text = value.trim()
  if (!text) return `Informe ${label}.`
  if (!INTEGER.test(text)) return 'Use um número inteiro.'
  const n = Number(text)
  if (n < min || n > max) return `Use um valor de ${min} a ${max}.`
  return undefined
}

export function validateAutoScheduleForm(form: AutoScheduleForm): AutoScheduleFormErrors {
  const errors: AutoScheduleFormErrors = {}
  const courts = checkInteger(form.courts, 1, 32, 'o número de quadras')
  if (courts) errors.courts = courts
  const match = checkInteger(form.matchMinutes, 5, 240, 'a duração da partida')
  if (match) errors.matchMinutes = match
  const rest = checkInteger(form.restMinutes, 0, 240, 'o descanso')
  if (rest) errors.restMinutes = rest
  if (!form.startAt) errors.startAt = 'Informe a data e a hora de início.'
  else if (Number.isNaN(new Date(form.startAt).getTime())) errors.startAt = 'Data e hora inválidas.'
  return errors
}

/** "YYYY-MM-DDTHH:mm" local → ISO 8601 com o deslocamento local (ex.: "2026-10-24T09:00:00-03:00"). */
export function toOffsetIso(local: string, offsetMinutes?: number): string {
  const offset = offsetMinutes ?? -new Date(local).getTimezoneOffset()
  const sign = offset < 0 ? '-' : '+'
  const abs = Math.abs(offset)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  const withSeconds = /T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local
  return `${withSeconds}${sign}${hh}:${mm}`
}

/** Só chame com um formulário sem erros de `validateAutoScheduleForm`. */
export function buildAutoScheduleRequest(form: AutoScheduleForm, dryRun: boolean): AutoScheduleRequest {
  return {
    courts: Number(form.courts),
    startAt: toOffsetIso(form.startAt),
    matchMinutes: Number(form.matchMinutes),
    restMinutes: Number(form.restMinutes),
    reschedule: form.reschedule,
    dryRun,
  }
}

export interface ScheduleDayRow {
  /** "HH:mm" no fuso de exibição. */
  time: string
  /** Quadra → partida. */
  cells: Map<number, AutoScheduleAssignment>
}

export interface ScheduleDay {
  key: string
  label: string
  /** Quadras com partida nesse dia, em ordem. */
  courts: number[]
  rows: ScheduleDayRow[]
}

/** Agrupa a proposta por dia e, dentro dele, por horário (linhas) e quadra (colunas). */
export function groupAssignmentsByDay(assignments: AutoScheduleAssignment[], timeZone?: string): ScheduleDay[] {
  const keyOf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const labelOf = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long', day: '2-digit', month: 'long' })
  const timeOf = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })

  const sorted = [...assignments].sort(
    (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.courtNumber - b.courtNumber,
  )
  const days = new Map<string, ScheduleDay>()
  for (const a of sorted) {
    const date = new Date(a.scheduledAt)
    const key = keyOf.format(date)
    let day = days.get(key)
    if (!day) {
      day = { key, label: labelOf.format(date), courts: [], rows: [] }
      days.set(key, day)
    }
    if (!day.courts.includes(a.courtNumber)) day.courts.push(a.courtNumber)
    const time = timeOf.format(date)
    let row = day.rows.find((r) => r.time === time)
    if (!row) {
      row = { time, cells: new Map() }
      day.rows.push(row)
    }
    row.cells.set(a.courtNumber, a)
  }
  for (const day of days.values()) day.courts.sort((x, y) => x - y)
  return [...days.values()]
}
