import { describe, expect, it } from 'vitest'
import { isPodium, summarizeAthlete } from './athlete-stats'

describe('summarizeAthlete', () => {
  it('conta torneios distintos, títulos e pódios', () => {
    const summary = summarizeAthlete(
      [
        { tournamentId: 'a', finalPlacement: 1 },
        { tournamentId: 'a', finalPlacement: 3 },
        { tournamentId: 'b', finalPlacement: 2 },
        { tournamentId: 'c', finalPlacement: 5 },
        { tournamentId: 'd', finalPlacement: null },
      ],
      [{ position: 7 }, { position: null }, { position: 2 }],
    )
    expect(summary).toEqual({ tournaments: 4, titles: 1, podiums: 3, bestRankingPosition: 2 })
  })

  it('devolve zeros e sem ranking quando não há dados', () => {
    expect(summarizeAthlete([], [])).toEqual({ tournaments: 0, titles: 0, podiums: 0, bestRankingPosition: null })
  })

  it('só 1º a 3º é pódio', () => {
    expect([1, 2, 3].every(isPodium)).toBe(true)
    expect(isPodium(4)).toBe(false)
    expect(isPodium(null)).toBe(false)
  })
})
