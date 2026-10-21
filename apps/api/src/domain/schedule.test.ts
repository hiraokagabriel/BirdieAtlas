import { describe, expect, it } from 'vitest'
import { buildMatchDefs } from './bracket.js'
import {
  planSchedule,
  REASON_DEPENDENCY,
  REASON_WINDOW,
  roundLabel,
  type PlanScheduleInput,
  type ScheduleMatch,
  type ScheduleResult,
} from './schedule.js'

const T0 = new Date('2026-10-24T09:00:00Z')
const at = (hhmm: string, day = '2026-10-24') => new Date(`${day}T${hhmm}:00Z`)
const hhmm = (d: Date) => d.toISOString().slice(11, 16)

/** Chave real do gerador: `slots` são ids de inscrição; byes são `null`. */
function bracket(drawId: string, slots: (string | null)[]): ScheduleMatch[] {
  return buildMatchDefs(drawId, slots).map((m) => ({
    id: m.id,
    drawId,
    round: m.round,
    position: m.position,
    status: m.status,
    registration1Id: m.registration1Id,
    registration2Id: m.registration2Id,
    nextMatchId: m.nextMatchId,
    scheduledAt: null,
    courtNumber: null,
  }))
}

/** Inscrição `rN` = atleta `aN`, salvo mapeamento explícito. */
function athletes(entries: Record<string, string[]>): Map<string, string[]> {
  return new Map(Object.entries(entries))
}
const singles = (n: number) => athletes(Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${i + 1}`, [`a${i + 1}`]])))

function plan(over: Partial<PlanScheduleInput> & Pick<PlanScheduleInput, 'matches'>): ScheduleResult {
  return planSchedule({
    athletesByRegistrationId: singles(16),
    courts: 1,
    startAt: T0,
    matchMinutes: 30,
    restMinutes: 0,
    ...over,
  })
}

const slotOf = (r: ScheduleResult, id: string) => r.assignments.find((a) => a.matchId === id)
const find = (ms: ScheduleMatch[], round: number, position: number) =>
  ms.find((m) => m.round === round && m.position === position) as ScheduleMatch

describe('planSchedule: chave única', () => {
  it('semifinais antes da final, uma quadra', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const r = plan({ matches: ms })
    expect(r.unscheduled).toEqual([])
    expect(r.assignments).toHaveLength(3)
    const [s1, s2] = [find(ms, 2, 1), find(ms, 2, 2)]
    const final = find(ms, 1, 1)
    expect(hhmm(slotOf(r, s1.id)!.scheduledAt)).toBe('09:00')
    expect(hhmm(slotOf(r, s2.id)!.scheduledAt)).toBe('09:30')
    expect(hhmm(slotOf(r, final.id)!.scheduledAt)).toBe('10:00')
    expect(r.assignments.every((a) => a.courtNumber === 1)).toBe(true)
  })

  it('duas quadras: primeira fase em paralelo, final por último', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])
    const r = plan({ matches: ms, courts: 2 })
    const firstPhase = ms.filter((m) => m.round === 3)
    expect(firstPhase.map((m) => hhmm(slotOf(r, m.id)!.scheduledAt)).sort()).toEqual(['09:00', '09:00', '09:30', '09:30'])
    const semis = ms.filter((m) => m.round === 2)
    expect(semis.map((m) => hhmm(slotOf(r, m.id)!.scheduledAt))).toEqual(['10:00', '10:00'])
    expect(hhmm(slotOf(r, find(ms, 1, 1).id)!.scheduledAt)).toBe('10:30')
  })

  it('só começa depois que as duas partidas anteriores terminam', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])
    const r = plan({ matches: ms, courts: 4, restMinutes: 10 })
    const end = (id: string) => slotOf(r, id)!.scheduledAt.getTime() + 30 * 60_000
    for (const m of ms) {
      if (!m.nextMatchId) continue
      expect(slotOf(r, m.nextMatchId)!.scheduledAt.getTime()).toBeGreaterThanOrEqual(end(m.id) + 10 * 60_000)
    }
  })

  it('mais quadras que partidas usa só as primeiras quadras', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const r = plan({ matches: ms, courts: 8 })
    expect(r.assignments.map((a) => a.courtNumber).sort()).toEqual([1, 1, 2])
    expect(hhmm(slotOf(r, find(ms, 1, 1).id)!.scheduledAt)).toBe('09:30')
  })

  it('descanso entre fases', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const r = plan({ matches: ms, courts: 2, restMinutes: 15 })
    expect(hhmm(slotOf(r, find(ms, 1, 1).id)!.scheduledAt)).toBe('09:45')
  })

  it('respeita o horário inicial', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    const r = plan({ matches: ms, startAt: at('14:20') })
    expect(hhmm(r.assignments[0]!.scheduledAt)).toBe('14:20')
  })

  it('byes não são agendados e não atrasam a final', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', null])
    const bye = ms.find((m) => m.round === 2 && m.status === 'walkover')!
    const real = ms.find((m) => m.round === 2 && m.status === 'pending')!
    const r = plan({ matches: ms })
    expect(slotOf(r, bye.id)).toBeUndefined()
    expect(r.unscheduled).toEqual([])
    expect(hhmm(slotOf(r, real.id)!.scheduledAt)).toBe('09:00')
    expect(hhmm(slotOf(r, find(ms, 1, 1).id)!.scheduledAt)).toBe('09:30')
  })

  it('chave de 8 com 5 inscritos: três byes, quatro partidas reais', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4', 'r5', null, null, null])
    const r = plan({ matches: ms, courts: 2 })
    expect(r.assignments).toHaveLength(ms.filter((m) => m.status === 'pending').length)
    expect(r.unscheduled).toEqual([])
  })

  it('partidas encerradas e em andamento sem horário não entram na proposta', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    find(ms, 2, 1).status = 'completed'
    find(ms, 2, 2).status = 'in_progress'
    const r = plan({ matches: ms, courts: 2 })
    expect(r.assignments.map((a) => a.matchId)).toEqual([find(ms, 1, 1).id])
    // Sem horário nas semifinais, a final só respeita o início
    expect(hhmm(r.assignments[0]!.scheduledAt)).toBe('09:00')
  })
})

describe('planSchedule: atletas', () => {
  it('atleta em duas categorias (MS e MD) nunca joga duas partidas ao mesmo tempo', () => {
    const ms = bracket('ms', ['r1', 'r2'])
    const md = bracket('md', ['p1', 'p2'])
    const r = plan({
      matches: [...ms, ...md],
      courts: 2,
      athletesByRegistrationId: athletes({ r1: ['ana'], r2: ['bia'], p1: ['ana', 'cris'], p2: ['bia', 'dani'] }),
    })
    const a = slotOf(r, ms[0]!.id)!
    const b = slotOf(r, md[0]!.id)!
    expect(a.scheduledAt.getTime()).not.toBe(b.scheduledAt.getTime())
    expect(Math.abs(a.scheduledAt.getTime() - b.scheduledAt.getTime())).toBeGreaterThanOrEqual(30 * 60_000)
  })

  it('atleta em duas categorias respeita o descanso entre elas', () => {
    const ms = bracket('ms', ['r1', 'r2'])
    const md = bracket('md', ['p1', 'p2'])
    const r = plan({
      matches: [...ms, ...md],
      courts: 2,
      restMinutes: 20,
      athletesByRegistrationId: athletes({ r1: ['ana'], r2: ['bia'], p1: ['ana', 'cris'], p2: ['dani', 'eva'] }),
    })
    const times = [slotOf(r, ms[0]!.id)!, slotOf(r, md[0]!.id)!].map((a) => a.scheduledAt.getTime()).sort()
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(50 * 60_000)
  })

  it('parceiro compartilhado entre duplas de categorias diferentes', () => {
    const md1 = bracket('md1', ['p1', 'p2'])
    const md2 = bracket('md2', ['p3', 'p4'])
    const r = plan({
      matches: [...md1, ...md2],
      courts: 3,
      athletesByRegistrationId: athletes({
        p1: ['ana', 'bia'], p2: ['cris', 'dani'],
        p3: ['ana', 'eva'], p4: ['fabi', 'gabi'],
      }),
    })
    const t1 = slotOf(r, md1[0]!.id)!.scheduledAt.getTime()
    const t2 = slotOf(r, md2[0]!.id)!.scheduledAt.getTime()
    expect(Math.abs(t1 - t2)).toBeGreaterThanOrEqual(30 * 60_000)
  })

  it('duplas sem atleta em comum jogam em paralelo', () => {
    const md1 = bracket('md1', ['p1', 'p2'])
    const md2 = bracket('md2', ['p3', 'p4'])
    const r = plan({
      matches: [...md1, ...md2],
      courts: 2,
      athletesByRegistrationId: athletes({ p1: ['a', 'b'], p2: ['c', 'd'], p3: ['e', 'f'], p4: ['g', 'h'] }),
    })
    expect(r.assignments.map((a) => hhmm(a.scheduledAt))).toEqual(['09:00', '09:00'])
  })

  it('partida encerrada de outra categoria conta para descanso', () => {
    const ms = bracket('ms', ['r1', 'r2'])
    const other = bracket('md', ['p1', 'p2'])
    other[0]!.status = 'completed'
    other[0]!.scheduledAt = at('09:00')
    other[0]!.courtNumber = 3
    const r = plan({
      matches: [...ms, ...other],
      courts: 2,
      restMinutes: 30,
      athletesByRegistrationId: athletes({ r1: ['ana'], r2: ['bia'], p1: ['ana', 'cris'], p2: ['dani', 'eva'] }),
    })
    // Ana terminou às 09:30; descanso de 30 minutos
    expect(hhmm(slotOf(r, ms[0]!.id)!.scheduledAt)).toBe('10:00')
  })

  it('partida futura considera todos os atletas que podem chegar a ela', () => {
    const ms = bracket('ms', ['r1', 'r2', 'r3', 'r4'])
    const other = bracket('md', ['p1', 'p2'])
    other[0]!.status = 'completed'
    other[0]!.scheduledAt = at('10:30')
    other[0]!.courtNumber = 9
    const r = plan({
      matches: [...ms, ...other],
      courts: 2,
      matchMinutes: 60,
      athletesByRegistrationId: athletes({
        r1: ['a1'], r2: ['a2'], r3: ['a3'], r4: ['a4'],
        p1: ['a4', 'x'], p2: ['y', 'z'],
      }),
    })
    // Semifinais às 09:00 (a4 termina às 10:00); final pronta às 10:00, mas a4 pode chegar a ela
    // e joga outra partida das 10:30 às 11:30, então a final espera.
    const semiWithA4 = ms.find((m) => m.round === 2 && m.registration2Id === 'r4')!
    expect(hhmm(slotOf(r, semiWithA4.id)!.scheduledAt)).toBe('09:00')
    expect(hhmm(slotOf(r, find(ms, 1, 1).id)!.scheduledAt)).toBe('11:30')
  })

  it('inscrição sem atletas conhecidos não trava o plano', () => {
    const ms = bracket('d1', ['ghost1', 'ghost2'])
    const r = plan({ matches: ms, athletesByRegistrationId: new Map() })
    expect(r.assignments).toHaveLength(1)
  })
})

describe('planSchedule: partidas já agendadas', () => {
  it('mantidas como obstáculos de quadra', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const fixed = find(ms, 2, 1)
    fixed.scheduledAt = at('09:00')
    fixed.courtNumber = 1
    const r = plan({ matches: ms, courts: 1 })
    expect(slotOf(r, fixed.id)).toBeUndefined()
    // Outra semifinal só entra depois, na única quadra
    expect(hhmm(slotOf(r, find(ms, 2, 2).id)!.scheduledAt)).toBe('09:30')
    expect(hhmm(slotOf(r, find(ms, 1, 1).id)!.scheduledAt)).toBe('10:00')
  })

  it('usa outra quadra quando uma está ocupada', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const fixed = find(ms, 2, 1)
    fixed.scheduledAt = at('09:00')
    fixed.courtNumber = 1
    const r = plan({ matches: ms, courts: 2 })
    const s2 = slotOf(r, find(ms, 2, 2).id)!
    expect([hhmm(s2.scheduledAt), s2.courtNumber]).toEqual(['09:00', 2])
  })

  it('o horário fixo da partida anterior define o início da seguinte', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    for (const [i, m] of [find(ms, 2, 1), find(ms, 2, 2)].entries()) {
      m.scheduledAt = at(i === 0 ? '09:00' : '11:00')
      m.courtNumber = i + 1
    }
    const r = plan({ matches: ms, courts: 2, restMinutes: 10 })
    expect(r.assignments).toHaveLength(1)
    expect(hhmm(r.assignments[0]!.scheduledAt)).toBe('11:40')
  })

  it('horário sem quadra é replanejado, com aviso', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    ms[0]!.scheduledAt = at('15:00')
    const r = plan({ matches: ms })
    expect(hhmm(r.assignments[0]!.scheduledAt)).toBe('09:00')
    expect(r.warnings.join(' ')).toContain('só horário ou só quadra')
  })

  it('sem reschedule nada já agendado entra na proposta', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    for (const [i, m] of ms.entries()) {
      m.scheduledAt = at(`1${i}:00`)
      m.courtNumber = 1
    }
    const r = plan({ matches: ms })
    expect(r.assignments).toEqual([])
    expect(r.unscheduled).toEqual([])
  })

  it('reschedule replaneja as pendentes, mas preserva em andamento e encerradas', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const live = find(ms, 2, 1)
    live.status = 'in_progress'
    live.scheduledAt = at('09:00')
    live.courtNumber = 1
    const other = find(ms, 2, 2)
    other.scheduledAt = at('18:00')
    other.courtNumber = 1
    const final = find(ms, 1, 1)
    final.scheduledAt = at('20:00')
    final.courtNumber = 1
    const r = plan({ matches: ms, courts: 1, reschedule: true })
    expect(slotOf(r, live.id)).toBeUndefined()
    // A ao vivo ocupa a quadra 1 das 09:00 às 09:30
    expect(hhmm(slotOf(r, other.id)!.scheduledAt)).toBe('09:30')
    expect(hhmm(slotOf(r, final.id)!.scheduledAt)).toBe('10:00')
  })

  it('reschedule libera o horário antigo das pendentes', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    ms[0]!.scheduledAt = at('13:00')
    ms[0]!.courtNumber = 1
    const r = plan({ matches: ms, reschedule: true })
    expect(hhmm(r.assignments[0]!.scheduledAt)).toBe('09:00')
  })

  it('avisa quando partidas fixas se sobrepõem', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    for (const m of [find(ms, 2, 1), find(ms, 2, 2)]) {
      m.scheduledAt = at('09:00')
      m.courtNumber = 1
    }
    const r = plan({ matches: ms })
    expect(r.warnings.join(' ')).toContain('se sobrepõem')
  })

  it('avisa quando uma partida fixa começa antes da anterior terminar', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    const dep = bracket('d2', ['r3', 'r4', 'r5', 'r6'])
    const final = find(dep, 1, 1)
    final.scheduledAt = at('09:00')
    final.courtNumber = 2
    const r = plan({ matches: [...ms, ...dep], courts: 2 })
    expect(r.warnings.join(' ')).toContain('antes do fim')
  })
})

describe('planSchedule: janela diária', () => {
  it('rola para o dia seguinte no horário de início', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const r = plan({ matches: ms, matchMinutes: 60, dayStartsAt: '09:00', dayEndsAt: '11:00' })
    const times = r.assignments.map((a) => a.scheduledAt.toISOString())
    expect(times).toEqual(['2026-10-24T09:00:00.000Z', '2026-10-24T10:00:00.000Z', '2026-10-25T09:00:00.000Z'])
    expect(r.warnings.join(' ')).toContain('2 dias')
  })

  it('a partida precisa terminar até o fim do dia', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    const r = plan({ matches: ms, startAt: at('10:30'), matchMinutes: 60, dayStartsAt: '09:00', dayEndsAt: '11:00' })
    expect(r.assignments[0]!.scheduledAt.toISOString()).toBe('2026-10-25T09:00:00.000Z')
  })

  it('início do dia depois do horário inicial sobe para o início do dia', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    const r = plan({ matches: ms, startAt: at('07:00'), dayStartsAt: '08:30', dayEndsAt: '18:00' })
    expect(hhmm(r.assignments[0]!.scheduledAt)).toBe('08:30')
  })

  it('lê a janela no fuso informado (-03:00)', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const r = plan({
      matches: ms,
      startAt: new Date('2026-10-24T12:00:00Z'), // 09:00 em -03:00
      utcOffsetMinutes: -180,
      matchMinutes: 60,
      dayStartsAt: '09:00',
      dayEndsAt: '11:00',
    })
    expect(r.assignments.map((a) => a.scheduledAt.toISOString())).toEqual([
      '2026-10-24T12:00:00.000Z',
      '2026-10-24T13:00:00.000Z',
      '2026-10-25T12:00:00.000Z',
    ])
  })

  it('só dayEndsAt: o início do dia é a hora de startAt', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const r = plan({ matches: ms, startAt: at('09:00'), matchMinutes: 60, dayEndsAt: '10:00' })
    expect(r.assignments.map((a) => a.scheduledAt.toISOString())).toEqual([
      '2026-10-24T09:00:00.000Z',
      '2026-10-25T09:00:00.000Z',
      '2026-10-26T09:00:00.000Z',
    ])
  })

  it('o descanso atravessa a virada do dia', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    const dep = bracket('d2', ['r1', 'r3'])
    const r = plan({ matches: [...ms, ...dep], courts: 2, restMinutes: 30, matchMinutes: 60, dayStartsAt: '09:00', dayEndsAt: '11:00' })
    const times = r.assignments.map((a) => a.scheduledAt.toISOString()).sort()
    expect(times).toEqual(['2026-10-24T09:00:00.000Z', '2026-10-25T09:00:00.000Z'])
  })

  it('janela menor que a partida: nada é agendado', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    const r = plan({ matches: ms, matchMinutes: 90, dayStartsAt: '09:00', dayEndsAt: '10:00' })
    expect(r.assignments).toEqual([])
    expect(r.unscheduled).toEqual([{ matchId: ms[0]!.id, reason: REASON_WINDOW }])
  })
})

describe('planSchedule: casos impossíveis e robustez', () => {
  it('cadeia inconsistente: dependente sem partida anterior agendada vai para unscheduled', () => {
    const a: ScheduleMatch = { id: 'a', drawId: 'd', round: 1, position: 2, status: 'pending', registration1Id: 'r1', registration2Id: 'r2', nextMatchId: 'b', scheduledAt: null, courtNumber: null }
    const b: ScheduleMatch = { id: 'b', drawId: 'd', round: 1, position: 1, status: 'pending', registration1Id: 'r3', registration2Id: 'r4', nextMatchId: 'a', scheduledAt: null, courtNumber: null }
    const r = plan({ matches: [a, b] })
    expect(r.unscheduled.map((u) => u.reason)).toContain(REASON_DEPENDENCY)
  })

  it('a mensagem de cada motivo está em português', () => {
    expect(REASON_DEPENDENCY).toMatch(/anterior/)
    expect(REASON_WINDOW).toMatch(/janela/)
  })

  it('sem partidas: resultado vazio', () => {
    expect(plan({ matches: [] })).toEqual({ assignments: [], unscheduled: [], warnings: [] })
  })

  it('é determinístico e não depende da ordem de entrada', () => {
    const a = bracket('da', ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])
    const b = bracket('db', ['r9', 'r10', 'r11', 'r12'])
    const input = [...a, ...b]
    const first = plan({ matches: input, courts: 3, restMinutes: 5 })
    const second = plan({ matches: input, courts: 3, restMinutes: 5 })
    const shuffled = plan({ matches: [...input].reverse(), courts: 3, restMinutes: 5 })
    expect(second).toEqual(first)
    expect(shuffled).toEqual(first)
  })

  it('não altera a entrada', () => {
    const ms = bracket('d1', ['r1', 'r2', 'r3', 'r4'])
    const snapshot = JSON.stringify(ms)
    plan({ matches: ms })
    expect(JSON.stringify(ms)).toBe(snapshot)
  })

  it('parâmetros inválidos lançam erro', () => {
    const ms = bracket('d1', ['r1', 'r2'])
    expect(() => plan({ matches: ms, courts: 0 })).toThrow(RangeError)
    expect(() => plan({ matches: ms, matchMinutes: 0 })).toThrow(RangeError)
    expect(() => plan({ matches: ms, restMinutes: -1 })).toThrow(RangeError)
    expect(() => plan({ matches: ms, dayStartsAt: '25:00' })).toThrow(RangeError)
  })

  it('torneio com várias categorias: sem sobreposição de quadra nem de atleta', () => {
    const drawA = bracket('da', ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])
    const drawB = bracket('db', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', null, null])
    const map = athletes({
      r1: ['a1'], r2: ['a2'], r3: ['a3'], r4: ['a4'], r5: ['a5'], r6: ['a6'], r7: ['a7'], r8: ['a8'],
      p1: ['a1', 'b1'], p2: ['a2', 'b2'], p3: ['a3', 'b3'], p4: ['a4', 'b4'], p5: ['a5', 'b5'], p6: ['a6', 'b6'],
    })
    const r = plan({ matches: [...drawA, ...drawB], athletesByRegistrationId: map, courts: 3, restMinutes: 15 })
    expect(r.unscheduled).toEqual([])
    const byId = new Map([...drawA, ...drawB].map((m) => [m.id, m]))
    const placed = r.assignments.map((a) => ({ ...a, start: a.scheduledAt.getTime(), end: a.scheduledAt.getTime() + 30 * 60_000 }))
    for (const x of placed) {
      for (const y of placed) {
        if (x.matchId >= y.matchId) continue
        if (x.courtNumber === y.courtNumber) expect(x.end <= y.start || y.end <= x.start).toBe(true)
        const ax = [byId.get(x.matchId)!.registration1Id, byId.get(x.matchId)!.registration2Id].flatMap((id) => (id ? map.get(id) ?? [] : []))
        const ay = [byId.get(y.matchId)!.registration1Id, byId.get(y.matchId)!.registration2Id].flatMap((id) => (id ? map.get(id) ?? [] : []))
        if (ax.some((a) => ay.includes(a))) {
          expect(x.end + 15 * 60_000 <= y.start || y.end + 15 * 60_000 <= x.start).toBe(true)
        }
      }
    }
  })
})

describe('roundLabel', () => {
  it('nomeia as rodadas contando até a final', () => {
    expect([1, 2, 3, 4, 5].map(roundLabel)).toEqual(['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final', 'Rodada 5'])
  })
})
