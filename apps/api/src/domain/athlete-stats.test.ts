import { describe, expect, it } from 'vitest'
import { longestWinStreak, resultFor, scoreFor, summarize, winnerSide } from './athlete-stats.js'

const sets = (...pairs: [number, number][]) => pairs.map(([score1, score2]) => ({ score1, score2 }))

describe('winnerSide / resultFor', () => {
  it('lê o vencedor dos sets', () => {
    expect(winnerSide(sets([21, 10], [21, 12]))).toBe(1)
    expect(winnerSide(sets([10, 21], [12, 21]))).toBe(2)
    expect(winnerSide(sets([21, 10], [10, 21]))).toBeNull()
    expect(winnerSide([])).toBeNull()
  })

  it('resultado depende do lado do atleta', () => {
    expect(resultFor({ side: 1, sets: sets([21, 10], [21, 12]) })).toBe('W')
    expect(resultFor({ side: 2, sets: sets([21, 10], [21, 12]) })).toBe('L')
    expect(resultFor({ side: 1, sets: [] })).toBeNull()
  })
})

describe('summarize', () => {
  it('soma vitórias, derrotas, sets e pontos pelo lado do atleta', () => {
    const summary = summarize([
      { side: 1, sets: sets([21, 15], [18, 21], [21, 19]) }, // vitória 2-1
      { side: 2, sets: sets([21, 10], [21, 12]) }, // derrota 0-2
    ])
    expect(summary).toEqual({
      played: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      setsWon: 2,
      setsLost: 3,
      pointsFor: 21 + 18 + 21 + 10 + 12,
      pointsAgainst: 15 + 21 + 19 + 21 + 21,
    })
  })

  it('partida sem vencedor definido não conta', () => {
    expect(summarize([{ side: 1, sets: [] }]).played).toBe(0)
  })

  it('sem partidas: tudo zero e taxa 0', () => {
    expect(summarize([])).toMatchObject({ played: 0, winRate: 0, wins: 0 })
  })

  it('taxa de vitórias com uma casa decimal', () => {
    const w = { side: 1 as const, sets: sets([21, 10], [21, 10]) }
    const l = { side: 2 as const, sets: sets([21, 10], [21, 10]) }
    expect(summarize([w, w, l]).winRate).toBe(66.7)
  })
})

describe('scoreFor', () => {
  it('mostra o placar do ponto de vista do atleta', () => {
    expect(scoreFor({ side: 1, sets: sets([21, 15], [18, 21]) })).toBe('21-15 18-21')
    expect(scoreFor({ side: 2, sets: sets([21, 15], [18, 21]) })).toBe('15-21 21-18')
  })
})

describe('longestWinStreak', () => {
  it('maior sequência de vitórias; derrota zera; null é ignorado', () => {
    expect(longestWinStreak(['W', 'W', 'L', 'W', 'W', 'W', 'L'])).toBe(3)
    expect(longestWinStreak(['W', null, 'W'])).toBe(2)
    expect(longestWinStreak([])).toBe(0)
  })
})
