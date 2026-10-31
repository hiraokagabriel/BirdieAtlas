import { describe, expect, it } from 'vitest'
import { sortRankingEntries, type RankableEntry } from './ranking-order.js'

function entry(id: string, totalPoints: number, counted: [number, number][], tournamentsCount = counted.length): RankableEntry {
  return {
    athleteId: id,
    athlete2Id: null,
    totalPoints,
    tournamentsCount,
    counted: counted.map(([points, placement]) => ({ points, placement })),
  }
}

const order = (list: RankableEntry[]) => sortRankingEntries(list).map((e) => e.athleteId)

describe('sortRankingEntries', () => {
  it('mais pontos vence', () => {
    expect(order([entry('a', 100, [[100, 1]]), entry('b', 150, [[150, 1]])])).toEqual(['b', 'a'])
  })

  it('mesmos pontos: mais títulos vence', () => {
    const twoTitles = entry('a', 100, [[50, 1], [50, 1]])
    const oneTitle = entry('b', 100, [[50, 1], [50, 2]])
    expect(order([oneTitle, twoTitles])).toEqual(['a', 'b'])
  })

  it('mesmos títulos: mais 2º lugares e depois mais 3º lugares', () => {
    const runnerUps = entry('a', 90, [[30, 2], [30, 2], [30, 3]])
    const thirds = entry('b', 90, [[30, 2], [30, 3], [30, 3]])
    expect(order([thirds, runnerUps])).toEqual(['a', 'b'])
  })

  it('mesma contagem de pódios: maior pontuação individual vence', () => {
    const peak = entry('a', 100, [[70, 5], [30, 5]])
    const flat = entry('b', 100, [[50, 5], [50, 5]])
    expect(order([flat, peak])).toEqual(['a', 'b'])
  })

  it('tudo igual: menos torneios vence e, por fim, o id decide', () => {
    const fewer = entry('b', 100, [[100, 5]], 1)
    const more = entry('a', 100, [[100, 5]], 3)
    expect(order([more, fewer])).toEqual(['b', 'a'])
    expect(order([entry('z', 10, [[10, 5]]), entry('y', 10, [[10, 5]])])).toEqual(['y', 'z'])
  })

  it('duplas com o mesmo primeiro atleta desempatam pelo segundo', () => {
    const a = { ...entry('x', 10, [[10, 5]]), athlete2Id: 'b' }
    const b = { ...entry('x', 10, [[10, 5]]), athlete2Id: 'a' }
    expect(sortRankingEntries([a, b]).map((e) => e.athlete2Id)).toEqual(['a', 'b'])
  })

  it('não altera o array recebido', () => {
    const list = [entry('a', 1, [[1, 5]]), entry('b', 2, [[2, 5]])]
    sortRankingEntries(list)
    expect(list.map((e) => e.athleteId)).toEqual(['a', 'b'])
  })
})
