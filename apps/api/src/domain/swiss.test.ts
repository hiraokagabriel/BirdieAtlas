import { describe, expect, it } from 'vitest'
import {
  buildSwissRoundDefs,
  computeSwissPlacements,
  computeSwissStandings,
  pairFirstRound,
  pairKey,
  pairSwissRound,
  planSwiss,
  swissProgress,
} from './swiss.js'

const sets = (...pairs: [number, number][]) => pairs.map(([score1, score2]) => ({ score1, score2 }))
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

describe('planSwiss', () => {
  it('padrão: ⌈log₂ n⌉ rodadas', () => {
    expect(planSwiss({ entries: 8 })).toEqual({ ok: true, rounds: 3 })
    expect(planSwiss({ entries: 9 })).toEqual({ ok: true, rounds: 4 })
    expect(planSwiss({ entries: 3 })).toEqual({ ok: true, rounds: 2 })
  })
  it('personaliza as rodadas e recusa o impossível', () => {
    expect(planSwiss({ entries: 8, rounds: 5 })).toEqual({ ok: true, rounds: 5 })
    expect(planSwiss({ entries: 8, rounds: 8 })).toMatchObject({ ok: false, error: expect.stringContaining('máximo é 7') })
    expect(planSwiss({ entries: 8, rounds: 0 })).toMatchObject({ ok: false })
    expect(planSwiss({ entries: 2 })).toMatchObject({ ok: false })
  })
})

describe('pairFirstRound', () => {
  it('cabeças enfrentam a outra metade; ímpar gera bye', () => {
    const entries = ids(6).map((id, i) => ({ id, seed: i < 2 ? i + 1 : null }))
    const pairing = pairFirstRound(entries, 'seeded')
    expect(pairing.pairs).toHaveLength(3)
    expect(pairing.bye).toBeNull()
    expect(pairing.pairs.flat().sort()).toEqual(ids(6))
    const odd = pairFirstRound(ids(5).map((id) => ({ id, seed: null })), 'random')
    expect(odd.pairs).toHaveLength(2)
    expect(odd.bye).not.toBeNull()
  })
})

describe('pairSwissRound', () => {
  it('une vizinhos da tabela sem repetir adversário', () => {
    const played = new Set([pairKey('p1', 'p2'), pairKey('p3', 'p4')])
    const result = pairSwissRound(['p1', 'p2', 'p3', 'p4'], played, new Set())
    expect(result.rematches).toBe(0)
    expect(result.pairs.every(([a, b]) => !played.has(pairKey(a, b)))).toBe(true)
    expect(result.pairs.flat().sort()).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('bye vai para o pior colocado que ainda não folgou', () => {
    const r = pairSwissRound(['a', 'b', 'c', 'd', 'e'], new Set(), new Set(['e']))
    expect(r.bye).toBe('d')
    expect(pairSwissRound(['a', 'b', 'c'], new Set(), new Set()).bye).toBe('c')
  })

  it('quando todos já folgaram, o último folga de novo', () => {
    expect(pairSwissRound(['a', 'b', 'c'], new Set(), new Set(['a', 'b', 'c'])).bye).toBe('c')
  })

  it('sem pareamento limpo, aceita o mínimo de repetições', () => {
    const played = new Set([pairKey('a', 'b'), pairKey('a', 'c'), pairKey('a', 'd'), pairKey('b', 'c'), pairKey('b', 'd'), pairKey('c', 'd')])
    const r = pairSwissRound(['a', 'b', 'c', 'd'], played, new Set())
    expect(r.pairs).toHaveLength(2)
    expect(r.rematches).toBeGreaterThan(0)
  })

  it('várias rodadas seguidas: ninguém repete adversário enquanto houver opção', () => {
    const players = ids(8)
    const played = new Set<string>()
    let ranked = players
    for (let round = 0; round < 4; round++) {
      const pairing = pairSwissRound(ranked, played, new Set())
      expect(pairing.rematches).toBe(0)
      for (const [a, b] of pairing.pairs) played.add(pairKey(a, b))
      ranked = [...ranked].reverse()
    }
    expect(played.size).toBe(16)
  })
})

describe('buildSwissRoundDefs', () => {
  it('numera as rodadas de trás para a frente e transforma o bye em partida de um lado só', () => {
    const defs = buildSwissRoundDefs('d', 3, 1, { pairs: [['a', 'b']], bye: 'c', rematches: 0 })
    expect(defs).toHaveLength(2)
    expect(defs[0]).toMatchObject({ round: 3, roundLabel: 'Rodada 1', status: 'pending', stage: 'swiss', registration1Id: 'a', registration2Id: 'b' })
    expect(defs[1]).toMatchObject({ round: 3, status: 'walkover', registration1Id: 'c', registration2Id: null })
    expect(buildSwissRoundDefs('d', 3, 3, { pairs: [['a', 'b']], bye: null, rematches: 0 })[0]!.round).toBe(1)
  })
})

describe('computeSwissStandings', () => {
  const matches = [
    { id: 'm1', registration1Id: 'a', registration2Id: 'b', status: 'completed' },
    { id: 'm2', registration1Id: 'c', registration2Id: 'd', status: 'completed' },
    { id: 'm3', registration1Id: 'a', registration2Id: 'c', status: 'completed' },
    { id: 'm4', registration1Id: 'b', registration2Id: 'd', status: 'completed' },
  ]
  const s = new Map([
    ['m1', sets([21, 10], [21, 10])], // a > b
    ['m2', sets([21, 10], [21, 10])], // c > d
    ['m3', sets([21, 19], [21, 19])], // a > c
    ['m4', sets([21, 10], [21, 10])], // b > d
  ])

  it('ordena por vitórias e desempata por Buchholz', () => {
    const rows = computeSwissStandings(['a', 'b', 'c', 'd'], matches, s)
    expect(rows.map((r) => [r.registrationId, r.wins])).toEqual([['a', 2], ['c', 1], ['b', 1], ['d', 0]])
    // b e c: 1 vitória, mesmo Buchholz (2) e mesmo saldo de sets (0); o saldo de pontos põe c na frente.
    expect(rows[1]!.buchholz).toBe(rows[2]!.buchholz)
  })

  it('bye conta como vitória e jogada, sem sets', () => {
    const rows = computeSwissStandings(['a', 'b', 'c'], [{ id: 'bye', registration1Id: 'c', registration2Id: null, status: 'walkover' }], new Map())
    const c = rows.find((r) => r.registrationId === 'c')!
    expect(c).toMatchObject({ wins: 1, played: 1, byes: 1 })
    expect(rows[0]!.registrationId).toBe('c')
  })

  it('Buchholz separa quem tem as mesmas vitórias', () => {
    // x venceu o líder; y venceu o último. Ambos 1 vitória e 1 derrota... mas x tem adversários mais fortes.
    const ms = [
      { id: '1', registration1Id: 'l', registration2Id: 'y', status: 'completed' },
      { id: '2', registration1Id: 'x', registration2Id: 'l', status: 'completed' },
      { id: '3', registration1Id: 'y', registration2Id: 'z', status: 'completed' },
      { id: '4', registration1Id: 'z', registration2Id: 'x', status: 'completed' },
    ]
    const ss = new Map([
      ['1', sets([21, 0], [21, 0])], // l > y
      ['2', sets([21, 0], [21, 0])], // x > l
      ['3', sets([21, 0], [21, 0])], // y > z
      ['4', sets([21, 0], [21, 0])], // z > x
    ])
    const rows = computeSwissStandings(['l', 'x', 'y', 'z'], ms, ss)
    expect(rows.every((r) => r.wins === 1)).toBe(true)
    expect(rows[0]!.buchholz).toBeGreaterThanOrEqual(rows[3]!.buchholz)
  })

  it('colocação é a posição na classificação', () => {
    const placements = computeSwissPlacements(matches, s)
    expect(placements.get('a')).toBe(1)
    expect(placements.get('d')).toBe(4)
  })
})

describe('swissProgress', () => {
  it('conta rodadas distintas geradas', () => {
    expect(swissProgress([{ round: 3 }, { round: 3 }, { round: 2 }], 3)).toEqual({ generated: 2, total: 3 })
  })
})
