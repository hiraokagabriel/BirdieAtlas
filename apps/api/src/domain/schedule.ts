// Agendamento automático de partidas por quadra e horário. Função pura: recebe as partidas do
// torneio inteiro e devolve a proposta, sem tocar no banco.
//
// Fuso horário: todos os instantes são `Date` (UTC). Só a janela diária ("HH:mm") depende de fuso, e
// é lida com `utcOffsetMinutes` (o deslocamento do `startAt` que o cliente enviou, ex.: -180). O
// deslocamento é fixo durante a agenda; não há tratamento de horário de verão.
//
// Convenção das chaves (ver bracket.ts): a rodada de número mais alto é a primeira fase e a rodada 1
// é a final. Uma partida só começa depois que as duas partidas que a alimentam (`nextMatchId`
// apontando para ela) terminam, mais o descanso.

import { parseTimeOfDay } from '@birdie-atlas/validators'

export type ScheduleMatchStatus = 'pending' | 'in_progress' | 'completed' | 'walkover' | 'retired'

export interface ScheduleMatch {
  id: string
  drawId: string
  /** A rodada de número mais alto é a primeira fase; a rodada 1 é a final. */
  round: number
  position: number
  status: ScheduleMatchStatus
  registration1Id: string | null
  registration2Id: string | null
  nextMatchId: string | null
  /** Eliminação dupla: para onde cai o perdedor. */
  loserNextMatchId?: string | null
  scheduledAt: Date | null
  courtNumber: number | null
}

export interface PlanScheduleInput {
  /** Todas as partidas do torneio, de todas as categorias. */
  matches: ScheduleMatch[]
  /** Atletas de cada inscrição (os dois parceiros numa dupla). Inscrição ausente conta como vazia. */
  athletesByRegistrationId: ReadonlyMap<string, readonly string[]>
  courts: number
  startAt: Date
  matchMinutes: number
  restMinutes: number
  /** Replaneja as partidas pendentes que já têm horário e quadra. Em andamento e encerradas nunca mudam. */
  reschedule?: boolean
  /** "HH:mm" no fuso de `utcOffsetMinutes`. Padrão: a hora de `startAt`. */
  dayStartsAt?: string
  /** "HH:mm" no fuso de `utcOffsetMinutes`. Padrão: meia-noite (fim do dia). */
  dayEndsAt?: string
  /** Deslocamento do fuso das janelas diárias, em minutos em relação ao UTC. Padrão 0. */
  utcOffsetMinutes?: number
}

export interface ScheduleAssignment {
  matchId: string
  courtNumber: number
  scheduledAt: Date
}

export interface UnscheduledMatch {
  matchId: string
  reason: string
}

export interface ScheduleResult {
  assignments: ScheduleAssignment[]
  unscheduled: UnscheduledMatch[]
  warnings: string[]
}

export const REASON_DEPENDENCY = 'Depende de uma partida anterior que não pôde ser agendada.'
export const REASON_NO_SLOT = 'Não foi encontrado horário livre com as quadras e o descanso informados.'
export const REASON_WINDOW = 'A janela diária é menor que a duração da partida.'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const MAX_ATTEMPTS = 20_000

interface Interval {
  start: number
  end: number
  matchId: string
}

function isFinished(status: ScheduleMatchStatus): boolean {
  return status === 'completed' || status === 'walkover' || status === 'retired'
}

function floorDiv(a: number, b: number): number {
  return Math.floor(a / b)
}

/** Rótulo da rodada para exibição: "Final", "Semifinal", "Quartas de final", "Oitavas de final". */
export function roundLabel(round: number): string {
  if (round === 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas de final'
  if (round === 4) return 'Oitavas de final'
  return `Rodada ${round}`
}

/** Rótulo da partida: o gravado (todos contra todos, grupos...) ou o da eliminação simples pela rodada. */
export function matchRoundLabel(match: { round: number; roundLabel?: string | null }): string {
  return match.roundLabel ?? roundLabel(match.round)
}

export interface DayWindowMinutes {
  startMin: number
  endMin: number
}

/** Janela diária em minutos desde 00:00 local; `null` sem janela. Lança `RangeError` se "HH:mm" for inválido. */
export function resolveDayWindowMinutes(
  input: Pick<PlanScheduleInput, 'startAt' | 'dayStartsAt' | 'dayEndsAt' | 'utcOffsetMinutes'>,
): DayWindowMinutes | null {
  if (input.dayStartsAt === undefined && input.dayEndsAt === undefined) return null

  let startMin: number
  if (input.dayStartsAt !== undefined) {
    const parsed = parseTimeOfDay(input.dayStartsAt)
    if (parsed === null) throw new RangeError(`dayStartsAt inválido: "${input.dayStartsAt}" (use HH:mm).`)
    startMin = parsed
  } else {
    const local = input.startAt.getTime() + (input.utcOffsetMinutes ?? 0) * MINUTE
    startMin = Math.floor((local - floorDiv(local, DAY) * DAY) / MINUTE)
  }

  let endMin = 24 * 60
  if (input.dayEndsAt !== undefined) {
    const parsed = parseTimeOfDay(input.dayEndsAt)
    if (parsed === null) throw new RangeError(`dayEndsAt inválido: "${input.dayEndsAt}" (use HH:mm).`)
    endMin = parsed
  }
  return { startMin, endMin }
}

interface DayWindow {
  startMs: number
  endMs: number
}

function resolveWindow(input: PlanScheduleInput): DayWindow | null {
  const minutes = resolveDayWindowMinutes(input)
  return minutes ? { startMs: minutes.startMin * MINUTE, endMs: minutes.endMin * MINUTE } : null
}

export function planSchedule(input: PlanScheduleInput): ScheduleResult {
  const { matches, athletesByRegistrationId, courts, matchMinutes, restMinutes } = input
  if (!Number.isInteger(courts) || courts < 1) throw new RangeError('courts deve ser um inteiro a partir de 1.')
  if (!(matchMinutes > 0)) throw new RangeError('matchMinutes deve ser positivo.')
  if (!(restMinutes >= 0)) throw new RangeError('restMinutes não pode ser negativo.')
  if (Number.isNaN(input.startAt.getTime())) throw new RangeError('startAt inválido.')

  const reschedule = input.reschedule ?? false
  const offsetMs = (input.utcOffsetMinutes ?? 0) * MINUTE
  const duration = matchMinutes * MINUTE
  const rest = restMinutes * MINUTE
  const startAtMs = input.startAt.getTime()
  const window = resolveWindow(input)
  const warnings: string[] = []

  const byId = new Map(matches.map((m) => [m.id, m]))
  const feedersOf = new Map<string, ScheduleMatch[]>()
  const maxRoundByDraw = new Map<string, number>()
  for (const m of matches) {
    maxRoundByDraw.set(m.drawId, Math.max(maxRoundByDraw.get(m.drawId) ?? 0, m.round))
    if (m.nextMatchId && byId.has(m.nextMatchId)) {
      feedersOf.set(m.nextMatchId, [...(feedersOf.get(m.nextMatchId) ?? []), m])
    }
    if (m.loserNextMatchId && byId.has(m.loserNextMatchId)) {
      feedersOf.set(m.loserNextMatchId, [...(feedersOf.get(m.loserNextMatchId) ?? []), m])
    }
  }

  const registrationCount = (m: ScheduleMatch): number =>
    (m.registration1Id ? 1 : 0) + (m.registration2Id ? 1 : 0)

  // Bye: primeira fase com um único inscrito (walkover). Primeira fase vazia também não se joga.
  const isBye = (m: ScheduleMatch): boolean => {
    if (m.round !== maxRoundByDraw.get(m.drawId)) return false
    const count = registrationCount(m)
    return count === 0 || (count === 1 && m.status === 'walkover')
  }

  // Atletas que podem estar na partida: os inscritos já conhecidos e, enquanto falta um lado,
  // todos que ainda podem chegar pelas partidas anteriores. Garante que ninguém jogue duas partidas
  // ao mesmo tempo, qualquer que seja o vencedor.
  const potentialCache = new Map<string, Set<string>>()
  const potentialAthletes = (m: ScheduleMatch): Set<string> => {
    const cached = potentialCache.get(m.id)
    if (cached) return cached
    const result = new Set<string>()
    potentialCache.set(m.id, result)
    for (const regId of [m.registration1Id, m.registration2Id]) {
      if (regId) for (const athleteId of athletesByRegistrationId.get(regId) ?? []) result.add(athleteId)
    }
    if (registrationCount(m) < 2) {
      for (const feeder of feedersOf.get(m.id) ?? []) {
        if (isFinished(feeder.status) || isBye(feeder)) continue
        for (const athleteId of potentialAthletes(feeder)) result.add(athleteId)
      }
    }
    return result
  }

  const athleteIntervals = new Map<string, Interval[]>()
  const courtIntervals = new Map<number, Interval[]>()
  const push = <K,>(map: Map<K, Interval[]>, key: K, interval: Interval) => {
    const list = map.get(key)
    if (list) list.push(interval)
    else map.set(key, [interval])
  }
  const occupy = (m: ScheduleMatch, start: number, court: number | null) => {
    const interval: Interval = { start, end: start + duration, matchId: m.id }
    for (const athleteId of potentialAthletes(m)) push(athleteIntervals, athleteId, interval)
    if (court !== null) push(courtIntervals, court, interval)
  }

  // Classificação: ignoradas, fixas (obstáculos) e a planejar.
  const fixedStart = new Map<string, number>()
  const fixedPending: ScheduleMatch[] = []
  const toPlan: ScheduleMatch[] = []
  let partial = 0
  for (const m of matches) {
    if (isBye(m)) continue
    if (isFinished(m.status) || m.status === 'in_progress') {
      if (m.scheduledAt) {
        fixedStart.set(m.id, m.scheduledAt.getTime())
        occupy(m, m.scheduledAt.getTime(), m.courtNumber)
      }
      continue
    }
    const hasBoth = m.scheduledAt !== null && m.courtNumber !== null
    if (!reschedule && hasBoth) {
      fixedStart.set(m.id, (m.scheduledAt as Date).getTime())
      fixedPending.push(m)
      occupy(m, (m.scheduledAt as Date).getTime(), m.courtNumber)
      continue
    }
    if (!reschedule && (m.scheduledAt !== null || m.courtNumber !== null)) partial++
    toPlan.push(m)
  }
  if (partial > 0) {
    warnings.push(`${partial} partida(s) tinham só horário ou só quadra e foram replanejadas por completo.`)
  }

  // Ordem: fase (primeira fase antes, final por último), depois chave e posição.
  const phase = (m: ScheduleMatch) => (maxRoundByDraw.get(m.drawId) ?? m.round) - m.round
  toPlan.sort(
    (a, b) =>
      phase(a) - phase(b) ||
      (a.drawId < b.drawId ? -1 : a.drawId > b.drawId ? 1 : 0) ||
      a.position - b.position ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  const planSet = new Set(toPlan.map((m) => m.id))

  if (window && window.endMs - window.startMs < duration) {
    return {
      assignments: [],
      unscheduled: toPlan.map((m) => ({ matchId: m.id, reason: REASON_WINDOW })),
      warnings,
    }
  }

  const plannedStart = new Map<string, number>()
  const assignments: ScheduleAssignment[] = []
  const unscheduled: UnscheduledMatch[] = []

  /** Leva o instante para dentro da janela diária: antes do início sobe, sem espaço vai ao dia seguinte. */
  const adjustToWindow = (t: number): number => {
    if (!window) return t
    const local = t + offsetMs
    const dayStart = floorDiv(local, DAY) * DAY
    const timeOfDay = local - dayStart
    if (timeOfDay < window.startMs) return dayStart + window.startMs - offsetMs
    if (timeOfDay + duration > window.endMs) return dayStart + DAY + window.startMs - offsetMs
    return t
  }

  const findSlot = (athletes: Set<string>, lowerBound: number): { start: number; court: number } | null => {
    let t = lowerBound
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const adjusted = adjustToWindow(t)
      if (adjusted !== t) {
        t = adjusted
        continue
      }

      // Atleta: sem sobreposição e com descanso dos dois lados.
      let athleteJump = Infinity
      for (const athleteId of athletes) {
        for (const iv of athleteIntervals.get(athleteId) ?? []) {
          if (!(t >= iv.end + rest || t + duration + rest <= iv.start)) athleteJump = Math.min(athleteJump, iv.end + rest)
        }
      }
      if (athleteJump !== Infinity) {
        t = athleteJump
        continue
      }

      // Quadra: a mais baixa livre em [t, t + duração).
      let courtJump = Infinity
      for (let court = 1; court <= courts; court++) {
        let courtFreeUntilJump = Infinity
        for (const iv of courtIntervals.get(court) ?? []) {
          if (!(t >= iv.end || t + duration <= iv.start)) courtFreeUntilJump = Math.min(courtFreeUntilJump, iv.end)
        }
        if (courtFreeUntilJump === Infinity) return { start: t, court }
        courtJump = Math.min(courtJump, courtFreeUntilJump)
      }
      t = courtJump
    }
    return null
  }

  for (const m of toPlan) {
    let lowerBound = startAtMs
    let blocked = false
    for (const feeder of feedersOf.get(m.id) ?? []) {
      if (isBye(feeder)) continue
      const start = plannedStart.get(feeder.id) ?? fixedStart.get(feeder.id)
      if (start === undefined) {
        // A planejar e sem horário (não agendada ou fora de ordem) bloqueia; em andamento ou
        // encerrada sem horário não impõe nada.
        if (planSet.has(feeder.id)) blocked = true
        continue
      }
      lowerBound = Math.max(lowerBound, start + duration + rest)
    }
    if (blocked) {
      unscheduled.push({ matchId: m.id, reason: REASON_DEPENDENCY })
      continue
    }

    const slot = findSlot(potentialAthletes(m), lowerBound)
    if (!slot) {
      unscheduled.push({ matchId: m.id, reason: REASON_NO_SLOT })
      continue
    }
    plannedStart.set(m.id, slot.start)
    occupy(m, slot.start, slot.court)
    assignments.push({ matchId: m.id, courtNumber: slot.court, scheduledAt: new Date(slot.start) })
  }

  assignments.sort(
    (a, b) =>
      a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
      a.courtNumber - b.courtNumber ||
      (a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0),
  )

  // Avisos sobre as partidas que já estavam agendadas e foram mantidas.
  let conflicts = 0
  const seenPairs = new Set<string>()
  const fixedIds = new Set(fixedStart.keys())
  const countConflict = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    if (seenPairs.has(key)) return
    seenPairs.add(key)
    conflicts++
  }
  for (const list of athleteIntervals.values()) {
    const fixedList = list.filter((iv) => fixedIds.has(iv.matchId)).sort((a, b) => a.start - b.start)
    for (let i = 1; i < fixedList.length; i++) {
      const prev = fixedList[i - 1] as Interval
      const next = fixedList[i] as Interval
      if (next.start < prev.end + rest) countConflict(prev.matchId, next.matchId)
    }
  }
  for (const list of courtIntervals.values()) {
    const fixedList = list.filter((iv) => fixedIds.has(iv.matchId)).sort((a, b) => a.start - b.start)
    for (let i = 1; i < fixedList.length; i++) {
      const prev = fixedList[i - 1] as Interval
      const next = fixedList[i] as Interval
      if (next.start < prev.end) countConflict(prev.matchId, next.matchId)
    }
  }
  if (conflicts > 0) {
    warnings.push(`${conflicts} par(es) de partidas já agendadas se sobrepõem (mesma quadra ou mesmo atleta, ou sem o descanso informado). Elas foram mantidas.`)
  }

  let beforeFeeder = 0
  for (const m of fixedPending) {
    const start = fixedStart.get(m.id) as number
    const early = (feedersOf.get(m.id) ?? []).some((feeder) => {
      if (isBye(feeder)) return false
      const feederStart = plannedStart.get(feeder.id) ?? fixedStart.get(feeder.id)
      return feederStart !== undefined && start < feederStart + duration + rest
    })
    if (early) beforeFeeder++
  }
  if (beforeFeeder > 0) {
    warnings.push(`${beforeFeeder} partida(s) já agendada(s) começam antes do fim (mais o descanso) das partidas que as alimentam.`)
  }

  if (window && assignments.length > 0) {
    const days = new Set(assignments.map((a) => floorDiv(a.scheduledAt.getTime() + offsetMs, DAY)))
    if (days.size > 1) warnings.push(`A agenda ocupa ${days.size} dias.`)
  }

  return { assignments, unscheduled, warnings }
}
