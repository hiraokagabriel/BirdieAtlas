import { describe, expect, it } from 'vitest'
import { formatReportDate, formatReportDateTime, formatScore, joinClubs, pickWinner, roundLabel, sortByPlacement, sortMatchesForReport, sortScheduleForReport } from './report-format.js'

describe('roundLabel', () => {
  it('rodada 1 é a final', () => {
    expect(roundLabel(1)).toBe('Final')
    expect(roundLabel(2)).toBe('Semifinal')
    expect(roundLabel(3)).toBe('Quartas de final')
    expect(roundLabel(4)).toBe('Oitavas de final')
    expect(roundLabel(5)).toBe('Rodada 5')
  })
})

describe('formatScore', () => {
  it('junta os sets', () => {
    expect(formatScore([{ score1: 21, score2: 15 }, { score1: 18, score2: 21 }])).toBe('21-15 18-21')
    expect(formatScore([])).toBe('')
  })
})

describe('sortMatchesForReport', () => {
  it('primeira fase primeiro, final por último, posição como desempate', () => {
    const out = sortMatchesForReport([
      { round: 1, position: 1 }, { round: 2, position: 2 }, { round: 2, position: 1 },
    ])
    expect(out).toEqual([{ round: 2, position: 1 }, { round: 2, position: 2 }, { round: 1, position: 1 }])
  })
})

describe('pickWinner', () => {
  it('lado 1, lado 2 e sem vencedor (W.O. sem sets)', () => {
    expect(pickWinner(1, 'A', 'B')).toBe('A')
    expect(pickWinner(2, 'A', 'B')).toBe('B')
    expect(pickWinner(null, 'A', 'B')).toBeNull()
  })
})

describe('joinClubs', () => {
  it('não repete o clube da dupla e ignora ausentes', () => {
    expect(joinClubs(['Alfa', 'Alfa'])).toBe('Alfa')
    expect(joinClubs(['Alfa', undefined, 'Beta'])).toBe('Alfa / Beta')
    expect(joinClubs([])).toBe('')
  })
})

describe('sortByPlacement', () => {
  it('ordena pela colocação e desempata pelo id', () => {
    const out = sortByPlacement([
      { id: 'b', finalPlacement: 3 }, { id: 'a', finalPlacement: 3 }, { id: 'c', finalPlacement: 1 },
    ])
    expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('formatReportDateTime', () => {
  it('sai no horário de Brasília, 24 h', () => {
    expect(formatReportDateTime(new Date('2026-10-27T17:30:00Z'))).toBe('27/10/2026 14:30')
    expect(formatReportDateTime(new Date('2026-01-02T03:05:00Z'))).toBe('02/01/2026 00:05')
  })
})

describe('formatReportDate', () => {
  it('converte a data ISO e deixa valor inesperado como veio', () => {
    expect(formatReportDate('2026-03-15')).toBe('15/03/2026')
    expect(formatReportDate('x')).toBe('x')
  })
})

describe('sortScheduleForReport', () => {
  it('horário, depois quadra (sem quadra por último), depois a chave', () => {
    const at = (h: number) => new Date(`2026-10-27T${String(h).padStart(2, '0')}:00:00Z`)
    const out = sortScheduleForReport([
      { id: 'd', scheduledAt: at(11), courtNumber: 1, round: 1, position: 1 },
      { id: 'c', scheduledAt: at(10), courtNumber: null, round: 2, position: 1 },
      { id: 'b', scheduledAt: at(10), courtNumber: 2, round: 2, position: 2 },
      { id: 'a', scheduledAt: at(10), courtNumber: 1, round: 2, position: 1 },
    ])
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
