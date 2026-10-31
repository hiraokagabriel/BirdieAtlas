import { describe, expect, it } from 'vitest'
import {
  buildAutoScheduleRequest,
  groupAssignmentsByDay,
  toOffsetIso,
  validateAutoScheduleForm,
  type AutoScheduleAssignment,
  type AutoScheduleForm,
} from './auto-schedule'

const form: AutoScheduleForm = { courts: '2', startAt: '2026-10-24T09:00', matchMinutes: '40', restMinutes: '15', dayStartsAt: '', dayEndsAt: '', reschedule: false }

function assignment(id: string, scheduledAt: string, courtNumber: number): AutoScheduleAssignment {
  return {
    matchId: id, categoryId: 'c', categoryName: 'MS', discipline: 'MS', round: 1, roundLabel: 'Final', position: 1,
    participant1: 'A', participant2: 'B', courtNumber, scheduledAt,
  }
}

describe('validateAutoScheduleForm', () => {
  it('aceita um formulário válido', () => {
    expect(validateAutoScheduleForm(form)).toEqual({})
  })

  it('aceita os limites', () => {
    expect(validateAutoScheduleForm({ ...form, courts: '32', matchMinutes: '5', restMinutes: '0' })).toEqual({})
    expect(validateAutoScheduleForm({ ...form, courts: '1', matchMinutes: '240', restMinutes: '240' })).toEqual({})
  })

  it('recusa valores fora dos limites, vazios e não inteiros', () => {
    const errors = validateAutoScheduleForm({ ...form, courts: '33', matchMinutes: '4', restMinutes: '-1', startAt: '' })
    expect(errors.courts).toBe('Use um valor de 1 a 32.')
    expect(errors.matchMinutes).toBe('Use um valor de 5 a 240.')
    expect(errors.restMinutes).toBe('Use um número inteiro.')
    expect(errors.startAt).toBe('Informe a data e a hora de início.')
    expect(validateAutoScheduleForm({ ...form, courts: '' }).courts).toBe('Informe o número de quadras.')
    expect(validateAutoScheduleForm({ ...form, courts: '1.5' }).courts).toBe('Use um número inteiro.')
  })
})

describe('toOffsetIso', () => {
  it('acrescenta segundos e o deslocamento', () => {
    expect(toOffsetIso('2026-10-24T09:00', -180)).toBe('2026-10-24T09:00:00-03:00')
    expect(toOffsetIso('2026-10-24T09:00', 0)).toBe('2026-10-24T09:00:00+00:00')
    expect(toOffsetIso('2026-10-24T09:00', 330)).toBe('2026-10-24T09:00:00+05:30')
  })

  it('o instante resultante é o horário local informado', () => {
    const iso = toOffsetIso('2026-10-24T09:00')
    expect(new Date(iso).getTime()).toBe(new Date('2026-10-24T09:00').getTime())
  })
})

describe('buildAutoScheduleRequest', () => {
  it('converte para números e marca dryRun', () => {
    const body = buildAutoScheduleRequest({ ...form, reschedule: true }, true)
    expect(body).toMatchObject({ courts: 2, matchMinutes: 40, restMinutes: 15, reschedule: true, dryRun: true })
    expect(body.startAt).toMatch(/^2026-10-24T09:00:00[+-]\d{2}:\d{2}$/)
    expect(buildAutoScheduleRequest(form, false).dryRun).toBe(false)
  })
})

describe('groupAssignmentsByDay', () => {
  it('agrupa por dia, horário e quadra', () => {
    const days = groupAssignmentsByDay(
      [
        assignment('d', '2026-10-25T12:00:00.000Z', 1),
        assignment('b', '2026-10-24T12:00:00.000Z', 2),
        assignment('a', '2026-10-24T12:00:00.000Z', 1),
        assignment('c', '2026-10-24T12:45:00.000Z', 1),
      ],
      'America/Sao_Paulo',
    )
    expect(days.map((d) => d.key)).toEqual(['2026-10-24', '2026-10-25'])
    expect(days[0]!.courts).toEqual([1, 2])
    expect(days[0]!.rows.map((r) => r.time)).toEqual(['09:00', '09:45'])
    expect(days[0]!.rows[0]!.cells.get(2)?.matchId).toBe('b')
    expect(days[0]!.rows[1]!.cells.has(2)).toBe(false)
    expect(days[1]!.rows[0]!.cells.get(1)?.matchId).toBe('d')
  })

  it('vazio devolve nenhum dia', () => {
    expect(groupAssignmentsByDay([])).toEqual([])
  })
})

describe('janela diária', () => {
  it('vazia: não entra no corpo; preenchida: vai como HH:mm', () => {
    expect(buildAutoScheduleRequest(form, true)).not.toHaveProperty('dayStartsAt')
    const req = buildAutoScheduleRequest({ ...form, dayStartsAt: '09:00', dayEndsAt: '18:00' }, true)
    expect(req.dayStartsAt).toBe('09:00')
    expect(req.dayEndsAt).toBe('18:00')
  })

  it('valida formato e ordem', () => {
    expect(validateAutoScheduleForm({ ...form, dayStartsAt: '09:00', dayEndsAt: '18:00' })).toEqual({})
    expect(validateAutoScheduleForm({ ...form, dayStartsAt: '25:00' }).dayStartsAt).toBe('Use o formato HH:mm.')
    expect(validateAutoScheduleForm({ ...form, dayStartsAt: '18:00', dayEndsAt: '09:00' }).dayEndsAt).toBe(
      'O fim do dia deve ser depois do início.',
    )
    expect(validateAutoScheduleForm({ ...form, dayEndsAt: '18:00' })).toEqual({})
  })
})
