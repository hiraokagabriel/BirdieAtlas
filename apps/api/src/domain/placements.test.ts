import { describe, expect, it } from 'vitest'
import { computePlacements, type PlacementMatch, type PlacementSet } from './placements.js'

function m(id: string, round: number, r1: string | null, r2: string | null): PlacementMatch {
  return { id, round, registration1Id: r1, registration2Id: r2 }
}

const win1: PlacementSet[] = [{ score1: 21, score2: 10 }, { score1: 21, score2: 12 }]
const win2: PlacementSet[] = [{ score1: 10, score2: 21 }, { score1: 12, score2: 21 }]

describe('computePlacements', () => {
  it('final com 2 jogadores: 1º e 2º', () => {
    const p = computePlacements([m('f', 1, 'A', 'B')], new Map([['f', win1]]))
    expect(p.get('A')).toBe(1)
    expect(p.get('B')).toBe(2)
  })

  it('chave de 4: os dois perdedores da semifinal ficam em 3º', () => {
    const matches = [m('s1', 2, 'A', 'B'), m('s2', 2, 'C', 'D'), m('f', 1, 'A', 'C')]
    const sets = new Map<string, PlacementSet[]>([['s1', win1], ['s2', win1], ['f', win1]])
    const p = computePlacements(matches, sets)
    expect(p.get('A')).toBe(1)
    expect(p.get('C')).toBe(2)
    expect(p.get('B')).toBe(3)
    expect(p.get('D')).toBe(3)
  })

  it('bye: o lado presente avança e não ganha colocação de perdedor', () => {
    const matches = [m('s1', 2, 'A', null), m('s2', 2, 'C', 'D'), m('f', 1, 'A', 'C')]
    const sets = new Map<string, PlacementSet[]>([['s2', win1], ['f', win2]])
    const p = computePlacements(matches, sets)
    expect(p.get('C')).toBe(1)
    expect(p.get('A')).toBe(2)
    expect(p.get('D')).toBe(3)
    expect(p.size).toBe(3)
  })

  it('bye na final: o jogador presente é 1º', () => {
    const p = computePlacements([m('f', 1, null, 'B')], new Map())
    expect(p.get('B')).toBe(1)
  })

  it('partidas encerradas por W.O. ou desistência (sem status no tipo) decidem pelos sets', () => {
    const matches = [m('s1', 2, 'A', 'B'), m('s2', 2, 'C', 'D'), m('f', 1, 'A', 'D')]
    const sets = new Map<string, PlacementSet[]>([['s1', win1], ['s2', win2], ['f', win1]])
    const p = computePlacements(matches, sets)
    expect(p.get('A')).toBe(1)
    expect(p.get('D')).toBe(2)
    expect(p.get('B')).toBe(3)
    expect(p.get('C')).toBe(3)
  })

  it('partida com os dois lados é decidida só pelos sets', () => {
    const p = computePlacements([m('f', 1, 'A', 'B')], new Map([['f', win2]]))
    expect(p.get('B')).toBe(1)
    expect(p.get('A')).toBe(2)
  })

  it('empate de sets é ignorado', () => {
    const tie: PlacementSet[] = [{ score1: 21, score2: 10 }, { score1: 10, score2: 21 }]
    expect(computePlacements([m('f', 1, 'A', 'B')], new Map([['f', tie]])).size).toBe(0)
  })

  it('sem sets e sem bye é ignorada; partida sem os dois lados também', () => {
    const p = computePlacements([m('a', 1, 'A', 'B'), m('b', 2, null, null)], new Map())
    expect(p.size).toBe(0)
  })

  it('oitavas: perdedor da rodada 4 fica em 9º', () => {
    const p = computePlacements([m('o', 4, 'A', 'B')], new Map([['o', win1]]))
    expect(p.get('B')).toBe(9)
    expect(p.has('A')).toBe(false)
  })
})
