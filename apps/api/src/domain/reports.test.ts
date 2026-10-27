import { describe, expect, it } from 'vitest'
import {
  clubAthletesRows, formatReportDate, formatReportDateTime, formatSets, podiumRows, resultsRows, scheduleRows,
  type ReportMatch,
} from './reports.js'

const match = (overrides: Partial<ReportMatch> = {}): ReportMatch => ({
  categoryName: 'Simples Masculino',
  round: 1,
  position: 1,
  participant1: 'Ana',
  participant2: 'Bia',
  status: 'completed',
  sets: [],
  scheduledAt: null,
  courtNumber: null,
  ...overrides,
})

describe('formatSets', () => {
  it('joins the sets in order', () => {
    expect(formatSets([
      { setNumber: 2, score1: 3, score2: 6 },
      { setNumber: 1, score1: 6, score2: 4 },
      { setNumber: 3, score1: 7, score2: 5 },
    ])).toBe('6-4 3-6 7-5')
  })

  it('is empty without sets', () => {
    expect(formatSets([])).toBe('')
  })
})

describe('formatReportDateTime', () => {
  it('uses Brasília time', () => {
    expect(formatReportDateTime(new Date('2026-10-27T17:30:00Z'))).toBe('27/10/2026 14:30')
  })

  it('does not render midnight as 24:00', () => {
    expect(formatReportDateTime(new Date('2026-10-27T03:00:00Z'))).toBe('27/10/2026 00:00')
  })
})

describe('formatReportDate', () => {
  it('turns an ISO date into dd/MM/yyyy', () => {
    expect(formatReportDate('2026-03-05')).toBe('05/03/2026')
  })
})

describe('resultsRows', () => {
  it('lists the first round before the final and names the winner by the sets', () => {
    const rows = resultsRows([
      match({ round: 1, position: 1, participant1: 'Ana', participant2: 'Cris', sets: [{ setNumber: 1, score1: 4, score2: 6 }, { setNumber: 2, score1: 3, score2: 6 }] }),
      match({ round: 2, position: 1, participant1: 'Ana', participant2: 'Bia', sets: [{ setNumber: 1, score1: 6, score2: 0 }, { setNumber: 2, score1: 6, score2: 1 }] }),
    ])
    expect(rows.map((r) => r[1])).toEqual(['Semifinal', 'Final'])
    expect(rows[0]).toEqual(['Simples Masculino', 'Semifinal', 1, 'Ana', 'Bia', '6-0 6-1', 'Ana', 'Encerrada'])
    expect(rows[1]?.[6]).toBe('Cris')
  })

  it('leaves the winner empty when the match was not played and skips empty slots', () => {
    const rows = resultsRows([
      match({ status: 'pending' }),
      match({ participant1: null, participant2: null, position: 2 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.[6]).toBe('')
    expect(rows[0]?.[7]).toBe('Pendente')
  })

  it('gives a bye to the present side', () => {
    const rows = resultsRows([match({ participant2: null, status: 'walkover' })])
    expect(rows[0]).toEqual(['Simples Masculino', 'Final', 1, 'Ana', '', '', 'Ana', 'W.O.'])
  })

  it('sorts categories by name', () => {
    const rows = resultsRows([match({ categoryName: 'Dupla' }), match({ categoryName: 'Absoluto' })])
    expect(rows.map((r) => r[0])).toEqual(['Absoluto', 'Dupla'])
  })
})

describe('scheduleRows', () => {
  it('keeps only scheduled matches, by time and then court', () => {
    const rows = scheduleRows([
      match({ participant1: 'C', scheduledAt: new Date('2026-10-27T18:00:00Z'), courtNumber: 1 }),
      match({ participant1: 'B', scheduledAt: new Date('2026-10-27T17:00:00Z'), courtNumber: 2 }),
      match({ participant1: 'A', scheduledAt: new Date('2026-10-27T17:00:00Z'), courtNumber: 1 }),
      match({ participant1: 'Z', scheduledAt: null }),
    ])
    expect(rows.map((r) => r[4])).toEqual(['A', 'B', 'C'])
    expect(rows[0]).toEqual([1, '27/10/2026 14:00', 'Simples Masculino', 'Final', 'A', 'Bia', 'Encerrada'])
  })
})

describe('podiumRows', () => {
  it('orders by category and placement', () => {
    const rows = podiumRows([
      { categoryName: 'B', placement: 2, athlete: 'Y', partner: null, club: 'Clube' },
      { categoryName: 'A', placement: 3, athlete: 'Z', partner: 'W', club: '' },
      { categoryName: 'A', placement: 1, athlete: 'X', partner: null, club: 'Clube' },
    ])
    expect(rows).toEqual([
      ['A', 1, 'X', '', 'Clube'],
      ['A', 3, 'Z', 'W', ''],
      ['B', 2, 'Y', '', 'Clube'],
    ])
  })
})

describe('clubAthletesRows', () => {
  it('sorts by athlete and formats the affiliation date', () => {
    expect(clubAthletesRows([
      { clubName: 'Clube', athlete: 'Zélia', startedAt: '2026-01-02' },
      { clubName: 'Clube', athlete: 'Álvaro', startedAt: '2025-12-31' },
    ])).toEqual([
      ['Clube', 'Álvaro', '31/12/2025'],
      ['Clube', 'Zélia', '02/01/2026'],
    ])
  })
})
