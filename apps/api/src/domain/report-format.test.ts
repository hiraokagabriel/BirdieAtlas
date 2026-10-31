import { describe, expect, it } from 'vitest'
import { formatScore, roundLabel } from './report-format.js'

describe('roundLabel', () => {
  it('rodada 1 é a final', () => {
    expect(roundLabel(1)).toBe('Final')
    expect(roundLabel(2)).toBe('Semifinal')
    expect(roundLabel(3)).toBe('Quartas de final')
    expect(roundLabel(4)).toBe('Rodada 4')
  })
})

describe('formatScore', () => {
  it('junta os sets', () => {
    expect(formatScore([{ score1: 21, score2: 15 }, { score1: 18, score2: 21 }])).toBe('21-15 18-21')
    expect(formatScore([])).toBe('')
  })
})
