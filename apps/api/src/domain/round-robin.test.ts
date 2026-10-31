import { describe, expect, it } from 'vitest'
import { buildRoundRobinMatchDefs, computeRoundRobinPlacements, computeRoundRobinStandings } from './round-robin.js'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `r${i + 1}`)
const pairKey = (a: string | null, b: string | null) => [a, b].sort().join('|')

describe('buildRoundRobinMatchDefs', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    it(`${n} inscrições: todos enfrentam todos exatamente uma vez`, () => {
      const defs = buildRoundRobinMatchDefs('d', ids(n))
      const pairs = defs.map((m) => pairKey(m.registration1Id, m.registration2Id))
      expect(new Set(pairs).size).toBe(pairs.length)
      expect(pairs).toHaveLength((n * (n - 1)) / 2)
    })
  }

  it('ninguém joga duas vezes na mesma rodada e a 1ª rodada jogada tem o maior número', () => {
    const defs = buildRoundRobinMatchDefs('d', ids(6))
    const byRound = new Map<number, string[]>()
    for (const m of defs) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m.registration1Id!, m.registration2Id!])
    for (const list of byRound.values()) expect(new Set(list).size).toBe(list.length)
    expect([...byRound.keys()].sort((a, b) => b - a)).toEqual([5, 4, 3, 2, 1])
    expect(defs.find((m) => m.round === 5)?.roundLabel).toBe('Rodada 1')
    expect(defs.find((m) => m.round === 1)?.roundLabel).toBe('Rodada 5')
  })

  it('número ímpar: quem folga não gera partida e todas as partidas têm dois lados', () => {
    const defs = buildRoundRobinMatchDefs('d', ids(5))
    expect(defs.every((m) => m.registration1Id && m.registration2Id && m.nextMatchId === null && m.status === 'pending')).toBe(true)
  })

  it('posições dentro da rodada começam em 1', () => {
    const defs = buildRoundRobinMatchDefs('d', ids(4))
    for (const round of [1, 2, 3]) {
      expect(defs.filter((m) => m.round === round).map((m) => m.position).sort()).toEqual([1, 2])
    }
  })
})

function sets(...scores: [number, number][]) {
  return scores.map(([score1, score2]) => ({ score1, score2 }))
}

describe('computeRoundRobinStandings', () => {
  it('ordena por vitórias', () => {
    const matches = [
      { id: 'm1', registration1Id: 'a', registration2Id: 'b' },
      { id: 'm2', registration1Id: 'a', registration2Id: 'c' },
      { id: 'm3', registration1Id: 'b', registration2Id: 'c' },
    ]
    const s = new Map([
      ['m1', sets([21, 10], [21, 10])],
      ['m2', sets([21, 10], [21, 10])],
      ['m3', sets([21, 10], [21, 10])],
    ])
    expect(computeRoundRobinStandings(['a', 'b', 'c'], matches, s).map((r) => [r.registrationId, r.wins])).toEqual([
      ['a', 2],
      ['b', 1],
      ['c', 0],
    ])
  })

  it('empate de vitórias entre dois: confronto direto vence mesmo com pior saldo', () => {
    const matches = [
      { id: 'ab', registration1Id: 'a', registration2Id: 'b' },
      { id: 'ac', registration1Id: 'a', registration2Id: 'c' },
      { id: 'bc', registration1Id: 'b', registration2Id: 'c' },
      { id: 'ad', registration1Id: 'a', registration2Id: 'd' },
      { id: 'bd', registration1Id: 'b', registration2Id: 'd' },
      { id: 'cd', registration1Id: 'c', registration2Id: 'd' },
    ]
    const s = new Map([
      ['ab', sets([15, 21], [15, 21])], // b vence a
      ['ac', sets([21, 0], [21, 0])], // a vence c
      ['bc', sets([21, 19], [21, 19])], // b vence c
      ['ad', sets([21, 0], [21, 0])], // a vence d
      ['bd', sets([19, 21], [19, 21])], // d vence b
      ['cd', sets([21, 0], [21, 0])], // c vence d
    ])
    // a: 2 vitórias (c, d); b: 2 vitórias (a, c) e b venceu a no confronto direto.
    const order = computeRoundRobinStandings(['a', 'b', 'c', 'd'], matches, s).map((r) => r.registrationId)
    expect(order.slice(0, 2)).toEqual(['b', 'a'])
  })

  it('empate sem confronto direto: saldo de sets decide', () => {
    const matches = [
      { id: 'ac', registration1Id: 'a', registration2Id: 'c' },
      { id: 'bc', registration1Id: 'b', registration2Id: 'c' },
    ]
    const s = new Map([
      ['ac', sets([21, 5], [21, 5])],
      ['bc', sets([21, 19], [19, 21], [21, 19])],
    ])
    const order = computeRoundRobinStandings(['a', 'b', 'c'], matches, s).map((r) => r.registrationId)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('partida sem vencedor definido não conta', () => {
    const matches = [{ id: 'm', registration1Id: 'a', registration2Id: 'b' }]
    const rows = computeRoundRobinStandings(['a', 'b'], matches, new Map())
    expect(rows.every((r) => r.played === 0 && r.wins === 0)).toBe(true)
  })
})

describe('computeRoundRobinPlacements', () => {
  it('colocação é a posição na classificação', () => {
    const matches = [{ id: 'm', registration1Id: 'a', registration2Id: 'b' }]
    const placements = computeRoundRobinPlacements(matches, new Map([['m', sets([10, 21], [10, 21])]]))
    expect(placements.get('b')).toBe(1)
    expect(placements.get('a')).toBe(2)
  })
})
