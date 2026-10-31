import { describe, expect, it } from 'vitest'
import {
  buildGroupMatchDefs,
  buildKnockoutMatchDefs,
  computeGroupKnockoutPlacements,
  computeGroupStandings,
  distributeToGroups,
  isDrawFinished,
  pickQualifiers,
  planGroups,
} from './groups.js'

const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, seed: i < 4 ? i + 1 : null }))

describe('planGroups', () => {
  it('padrão: grupos de ~4 e 2 classificados por grupo', () => {
    const r = planGroups({ entries: 12 })
    expect(r.ok && r.plan).toMatchObject({ groupCount: 3, sizes: [4, 4, 4], advancePerGroup: 2, qualifiers: 6, bracketSize: 8, knockoutRounds: 3 })
  })

  it('tamanhos desiguais: os primeiros grupos ficam com uma pessoa a mais', () => {
    const r = planGroups({ entries: 10, groupCount: 3 })
    expect(r.ok && r.plan.sizes).toEqual([4, 3, 3])
  })

  it('pessoas por grupo define o número de grupos', () => {
    const r = planGroups({ entries: 9, groupSize: 3 })
    expect(r.ok && r.plan.groupCount).toBe(3)
  })

  it('personaliza grupos e classificados', () => {
    const r = planGroups({ entries: 16, groupCount: 4, advancePerGroup: 1 })
    expect(r.ok && r.plan).toMatchObject({ qualifiers: 4, bracketSize: 4, knockoutRounds: 2 })
  })

  it('recusa configurações impossíveis, com mensagem em português', () => {
    expect(planGroups({ entries: 3 })).toMatchObject({ ok: false })
    expect(planGroups({ entries: 8, groupCount: 5 })).toMatchObject({ ok: false, error: expect.stringContaining('máximo é 4 grupos') })
    expect(planGroups({ entries: 8, groupCount: 2, advancePerGroup: 4 })).toMatchObject({ ok: false, error: expect.stringContaining('no máximo 3') })
    expect(planGroups({ entries: 8, groupCount: 0 })).toMatchObject({ ok: false })
    expect(planGroups({ entries: 8, groupCount: 27 })).toMatchObject({ ok: false })
    expect(planGroups({ entries: 8, groupCount: 1, advancePerGroup: 1 })).toMatchObject({ ok: false, error: expect.stringContaining('pelo menos 2 classificados') })
  })
})

describe('distributeToGroups', () => {
  it('respeita os tamanhos e usa todo mundo uma vez', () => {
    const groups = distributeToGroups(entries(10), [4, 3, 3], 'random')
    expect(groups.map((g) => g.length)).toEqual([4, 3, 3])
    expect(new Set(groups.flat()).size).toBe(10)
  })

  it('com cabeças de chave, elas ficam em grupos diferentes (serpentina)', () => {
    const groups = distributeToGroups(entries(12), [4, 4, 4], 'seeded')
    const seedGroup = (id: string) => groups.findIndex((g) => g.includes(id))
    expect(new Set(['r1', 'r2', 'r3'].map(seedGroup)).size).toBe(3)
    expect(groups[0]).toContain('r1')
    expect(groups[2]).toContain('r3')
    expect(groups[2]).toContain('r4') // serpentina: o 4º volta pelo último grupo
  })
})

describe('buildGroupMatchDefs', () => {
  it('todos contra todos dentro de cada grupo, rodadas acima da eliminatória', () => {
    const defs = buildGroupMatchDefs('d', [['a', 'b', 'c', 'd'], ['e', 'f', 'g']], 3)
    expect(defs.filter((m) => m.groupKey === 'A')).toHaveLength(6)
    expect(defs.filter((m) => m.groupKey === 'B')).toHaveLength(3)
    expect(defs.every((m) => m.stage === 'group' && m.round > 3)).toBe(true)
    // Grupo A tem 3 rodadas; B (3 pessoas) tem 3 rodadas com folga: rodadas jogadas 1..3.
    expect(new Set(defs.map((m) => m.roundLabel))).toContain('Grupo A · Rodada 1')
    expect(new Set(defs.map((m) => m.roundLabel))).toContain('Grupo B · Rodada 3')
    // A rodada 1 jogada tem o maior número.
    const first = defs.find((m) => m.roundLabel === 'Grupo A · Rodada 1')!
    const last = defs.find((m) => m.roundLabel === 'Grupo A · Rodada 3')!
    expect(first.round).toBeGreaterThan(last.round)
    // Posições únicas dentro de cada rodada.
    const keys = defs.map((m) => `${m.round}:${m.position}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

function sets(...pairs: [number, number][]) {
  return pairs.map(([score1, score2]) => ({ score1, score2 }))
}

describe('classificados e eliminatória', () => {
  const groups = [['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']]
  const defs = buildGroupMatchDefs('d', groups, 2)
  // Em cada grupo, o id de menor número vence todos (x1 > x2 > x3).
  const setsByMatchId = new Map<string, { score1: number; score2: number }[]>()
  for (const m of defs) {
    const w1 = m.registration1Id! < m.registration2Id!
    setsByMatchId.set(m.id, w1 ? sets([21, 10], [21, 10]) : sets([10, 21], [10, 21]))
  }
  const standings = computeGroupStandings(defs, setsByMatchId)

  it('classificação por grupo', () => {
    expect(standings.map((g) => g.key)).toEqual(['A', 'B'])
    expect(standings[0]!.rows.map((r) => r.registrationId)).toEqual(['a1', 'a2', 'a3'])
  })

  it('cabeças: primeiro os 1º dos grupos, depois os 2º', () => {
    const q = pickQualifiers(standings, 2)
    expect(q.map((x) => [x.id, x.seed])).toEqual([['a1', 1], ['b1', 2], ['a2', 3], ['b2', 4]])
  })

  it('colegas de grupo não se enfrentam na primeira fase quando dá para evitar', () => {
    const q = pickQualifiers(standings, 2)
    for (let i = 0; i < 20; i++) {
      const ko = buildKnockoutMatchDefs('d', q)
      expect(ko.every((m) => m.stage === 'knockout')).toBe(true)
      const semis = ko.filter((m) => m.round === 2)
      const groupOf = new Map(q.map((x) => [x.id, x.groupKey]))
      expect(semis.every((m) => groupOf.get(m.registration1Id!) !== groupOf.get(m.registration2Id!))).toBe(true)
    }
  })

  it('número de classificados que não é potência de 2 gera byes', () => {
    const q = pickQualifiers(standings, 1) // 2 classificados: só a final
    expect(buildKnockoutMatchDefs('d', q)).toHaveLength(1)
    const three = pickQualifiers(computeGroupStandings(buildGroupMatchDefs('d', [['a', 'b'], ['c', 'd'], ['e', 'f']], 2), new Map()), 1)
    const ko = buildKnockoutMatchDefs('d', three)
    expect(ko.filter((m) => m.status === 'walkover')).toHaveLength(1)
  })
})

describe('isDrawFinished', () => {
  const done = { status: 'completed', registration1Id: 'a', registration2Id: 'b' }
  it('eliminação e todos contra todos: basta não haver pendência', () => {
    expect(isDrawFinished('single_elimination', [done])).toBe(true)
    expect(isDrawFinished('round_robin', [done, { ...done, status: 'pending' }])).toBe(false)
    expect(isDrawFinished('round_robin', [])).toBe(false)
  })
  it('grupos + eliminatória: exige a eliminatória criada', () => {
    expect(isDrawFinished('group_then_elimination', [{ ...done, stage: 'group' }])).toBe(false)
    expect(isDrawFinished('group_then_elimination', [{ ...done, stage: 'group' }, { ...done, stage: 'knockout' }])).toBe(true)
    expect(isDrawFinished('group_then_elimination', [{ ...done, stage: 'group' }, { ...done, stage: 'knockout', status: 'pending' }])).toBe(false)
  })
})

describe('isDrawFinished: eliminação dupla e suíço', () => {
  const done = { status: 'completed', registration1Id: 'a', registration2Id: 'b' }
  it('eliminação dupla: a grande final precisa ter sido jogada; o reset vazio não bloqueia', () => {
    const empty = { status: 'pending', stage: 'grand_final_reset', registration1Id: null, registration2Id: null }
    expect(isDrawFinished('double_elimination', [{ ...done, stage: 'winners' }, { ...done, stage: 'grand_final' }, empty])).toBe(true)
    expect(isDrawFinished('double_elimination', [{ ...done, stage: 'winners' }, { ...done, stage: 'grand_final', status: 'pending', registration2Id: null }])).toBe(false)
    expect(isDrawFinished('double_elimination', [{ ...done, stage: 'winners' }])).toBe(false)
    // Reset preenchido e ainda não jogado bloqueia.
    expect(isDrawFinished('double_elimination', [{ ...done, stage: 'grand_final' }, { ...done, stage: 'grand_final_reset', status: 'pending' }])).toBe(false)
  })
  it('suíço: todas as rodadas configuradas precisam existir', () => {
    const rounds = [{ ...done, round: 3 }, { ...done, round: 2 }]
    expect(isDrawFinished('swiss', rounds, { rounds: 3 })).toBe(false)
    expect(isDrawFinished('swiss', [...rounds, { ...done, round: 1 }], { rounds: 3 })).toBe(true)
    expect(isDrawFinished('swiss', rounds, null)).toBe(false)
  })
})

describe('computeGroupKnockoutPlacements', () => {
  it('eliminatória decide o pódio e quem caiu nos grupos fica em bracketSize + 1', () => {
    const groupDefs = buildGroupMatchDefs('d', [['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']], 1)
    const q = pickQualifiers(computeGroupStandings(groupDefs, new Map(groupDefs.map((m) => [m.id, m.registration1Id! < m.registration2Id! ? sets([21, 1], [21, 1]) : sets([1, 21], [1, 21])]))), 1)
    const ko = buildKnockoutMatchDefs('d', q) // final entre a1 e b1
    const final = ko[0]!
    const all = [...groupDefs, ...ko].map((m) => ({ ...m, id: m.id }))
    const setMap = new Map<string, { score1: number; score2: number }[]>()
    setMap.set(final.id, final.registration1Id === 'a1' ? sets([21, 5], [21, 5]) : sets([5, 21], [5, 21]))
    const placements = computeGroupKnockoutPlacements(all, setMap)
    expect(placements.get('a1')).toBe(1)
    expect(placements.get('b1')).toBe(2)
    expect(placements.get('a2')).toBe(3) // bracketSize = 2 -> 3
    expect(placements.get('b3')).toBe(3)
  })
})
