import { describe, expect, it } from 'vitest'
import {
  buildRounds,
  computePodium,
  describeSlot,
  effectiveWinner,
  indexEntries,
  isByeMatch,
  matchAriaLabel,
  matchWinner,
  roundTitle,
  statusChip,
  type BracketEntry,
  type BracketMatch,
  type SetScore,
} from './bracket'

function m(id: string, round: number, position: number, over: Partial<BracketMatch> = {}): BracketMatch {
  return { id, round, position, status: 'pending', registration1Id: null, registration2Id: null, ...over }
}

function entry(id: string, name: string, over: Partial<BracketEntry> = {}): BracketEntry {
  return { id, athleteId: `a-${id}`, athlete2Id: null, seed: null, athleteName: name, athlete2Name: null, ...over }
}

const sets = (matchId: string, ...scores: [number, number][]): SetScore[] =>
  scores.map(([score1, score2], i) => ({ matchId, setNumber: i + 1, score1, score2 }))

describe('roundTitle', () => {
  it('nomeia as fases finais e deriva as demais do número de participantes', () => {
    expect(roundTitle(1)).toBe('Final')
    expect(roundTitle(2)).toBe('Semifinal')
    expect(roundTitle(3)).toBe('Quartas de final')
    expect(roundTitle(4)).toBe('Oitavas de final')
    expect(roundTitle(5)).toBe('Fase de 32')
    expect(roundTitle(6)).toBe('Fase de 64')
  })
})

describe('buildRounds', () => {
  it('ordena da primeira fase até a final e as partidas por posição', () => {
    const rounds = buildRounds([m('f', 1, 1), m('s2', 2, 2), m('s1', 2, 1)])
    expect(rounds.map((r) => r.round)).toEqual([2, 1])
    expect(rounds[0].title).toBe('Semifinal')
    expect(rounds[0].matches.map((x) => x.id)).toEqual(['s1', 's2'])
  })

  it('devolve lista vazia sem partidas', () => {
    expect(buildRounds([])).toEqual([])
  })
})

describe('isByeMatch', () => {
  it('só vale na primeira fase, em walkover, com um único inscrito', () => {
    expect(isByeMatch(m('a', 3, 1, { status: 'walkover', registration1Id: 'r1' }), 3)).toBe(true)
    expect(isByeMatch(m('b', 3, 1, { status: 'walkover', registration1Id: 'r1', registration2Id: 'r2' }), 3)).toBe(false)
    expect(isByeMatch(m('c', 2, 1, { status: 'walkover', registration2Id: 'r2' }), 3)).toBe(false)
    expect(isByeMatch(m('d', 3, 1, { status: 'pending', registration1Id: 'r1' }), 3)).toBe(false)
  })
})

describe('matchWinner', () => {
  const done = m('x', 1, 1, { status: 'completed', registration1Id: 'r1', registration2Id: 'r2' })

  it('lê o vencedor dos sets salvos, não do slot', () => {
    expect(matchWinner(done, sets('x', [15, 21], [21, 18], [10, 21]))).toBe(2)
    expect(matchWinner(done, sets('x', [21, 10], [21, 18]))).toBe(1)
  })

  it('não define vencedor sem sets, empatado ou com a partida em aberto', () => {
    expect(matchWinner(done, [])).toBeNull()
    expect(matchWinner(done, sets('x', [21, 10], [10, 21]))).toBeNull()
    expect(matchWinner({ ...done, status: 'in_progress' }, sets('x', [21, 10], [21, 10]))).toBeNull()
  })

  it('o bye avança o inscrito presente sem precisar de sets', () => {
    const bye = m('b', 3, 1, { status: 'walkover', registration2Id: 'r2' })
    expect(effectiveWinner(bye, [], true)).toBe(2)
  })
})

describe('computePodium', () => {
  const matches = [
    m('s1', 2, 1, { status: 'completed', registration1Id: 'r1', registration2Id: 'r2' }),
    m('f', 1, 1, { status: 'completed', registration1Id: 'r1', registration2Id: 'r3' }),
  ]

  it('devolve campeão e vice quando a final tem vencedor', () => {
    expect(computePodium(matches, sets('f', [21, 5], [21, 7]))).toEqual({ champion: 'r1', runnerUp: 'r3' })
    expect(computePodium(matches, sets('f', [5, 21], [7, 21]))).toEqual({ champion: 'r3', runnerUp: 'r1' })
  })

  it('devolve null enquanto a final não terminou ou não existe', () => {
    expect(computePodium(matches, [])).toBeNull()
    expect(computePodium([m('s1', 2, 1)], [])).toBeNull()
  })
})

describe('describeSlot', () => {
  const entries = indexEntries([
    entry('r1', 'Ana', { seed: 1 }),
    entry('r2', 'Bia', { athlete2Id: 'a-x', athlete2Name: 'Cris' }),
  ])

  it('descreve atleta, dupla, bye e vaga a definir', () => {
    expect(describeSlot('r1', entries, false)).toMatchObject({ kind: 'athlete', seed: 1, label: 'Ana' })
    expect(describeSlot('r2', entries, false)).toMatchObject({ kind: 'athlete', label: 'Bia / Cris' })
    expect(describeSlot(null, entries, true)).toEqual({ kind: 'bye' })
    expect(describeSlot(null, entries, false)).toEqual({ kind: 'tbd' })
  })

  it('não quebra com inscrição desconhecida', () => {
    expect(describeSlot('zzz', entries, false)).toMatchObject({ kind: 'athlete', label: 'Participante' })
  })
})

describe('statusChip', () => {
  it('usa os valores reais do status da partida', () => {
    expect(statusChip(m('a', 1, 1), false).key).toBe('waiting')
    expect(statusChip(m('a', 1, 1, { courtNumber: 2 }), false).key).toBe('scheduled')
    expect(statusChip(m('a', 1, 1, { status: 'in_progress' }), false).label).toBe('Ao vivo')
    expect(statusChip(m('a', 1, 1, { status: 'completed' }), false).label).toBe('Finalizada')
    expect(statusChip(m('a', 1, 1, { status: 'walkover' }), false).label).toBe('W.O.')
    expect(statusChip(m('a', 1, 1, { status: 'retired' }), false).label).toBe('Desistência')
    expect(statusChip(m('a', 3, 1, { status: 'walkover' }), true).label).toBe('BYE')
  })
})

describe('matchAriaLabel', () => {
  const entries = indexEntries([entry('r1', 'Ana'), entry('r2', 'Bia')])
  const a = describeSlot('r1', entries, false)
  const b = describeSlot('r2', entries, false)

  it('descreve partida com e sem vencedor', () => {
    expect(matchAriaLabel('Quartas de final', 2, a, b, 1, false)).toBe('Quartas de final, partida 2: Ana contra Bia, vencedor Ana')
    expect(matchAriaLabel('Semifinal', 1, a, { kind: 'tbd' }, null, false)).toBe('Semifinal, partida 1: Ana contra a definir')
  })

  it('descreve bye', () => {
    expect(matchAriaLabel('Oitavas de final', 3, { kind: 'bye' }, b, 2, true)).toBe('Oitavas de final, partida 3: Bia avança por BYE')
  })
})
