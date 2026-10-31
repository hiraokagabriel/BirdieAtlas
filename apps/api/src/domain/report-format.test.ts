import { describe, expect, it } from 'vitest'
import { formatScore, joinClubs, pickWinner, roundLabel, sortByPlacement, sortMatchesForReport } from './report-format.js'

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
