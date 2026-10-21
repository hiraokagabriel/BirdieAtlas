import { describe, expect, it } from 'vitest'
import { canAddPoint, computeLiveScore, setWinner, toResultSets, type Side } from './live-score.js'

function rally(side: Side, times: number): Side[] {
  return Array.from({ length: times }, () => side)
}

/** Pontos que levam um set de 0-0 até `a`-`b`, intercalando para não fechar o set antes da hora. */
function setPoints(a: number, b: number): Side[] {
  const out: Side[] = []
  let x = 0
  let y = 0
  while (x < a || y < b) {
    if (x < a && (x <= y || y >= b)) {
      out.push(1)
      x++
    } else {
      out.push(2)
      y++
    }
  }
  return out
}

describe('setWinner', () => {
  it('exige 21 pontos', () => {
    expect(setWinner(20, 0)).toBeNull()
    expect(setWinner(21, 0)).toBe(1)
    expect(setWinner(0, 21)).toBe(2)
  })

  it('exige diferença de 2 a partir de 20-20', () => {
    expect(setWinner(21, 20)).toBeNull()
    expect(setWinner(22, 20)).toBe(1)
    expect(setWinner(21, 19)).toBe(1)
    expect(setWinner(25, 24)).toBeNull()
    expect(setWinner(24, 26)).toBe(2)
  })

  it('limita em 30: aos 29-29 o ponto seguinte decide', () => {
    expect(setWinner(29, 29)).toBeNull()
    expect(setWinner(30, 29)).toBe(1)
    expect(setWinner(29, 30)).toBe(2)
    expect(setWinner(30, 28)).toBe(1)
  })
})

describe('computeLiveScore', () => {
  it('começa em 0-0 no set 1', () => {
    expect(computeLiveScore([])).toEqual({
      sets: [],
      currentSet: { setNumber: 1, score1: 0, score2: 0 },
      setsWon: { side1: 0, side2: 0 },
      winner: null,
    })
  })

  it('acompanha o set em andamento', () => {
    const score = computeLiveScore([1, 1, 2])
    expect(score.currentSet).toEqual({ setNumber: 1, score1: 2, score2: 1 })
    expect(score.sets).toEqual([])
  })

  it('fecha o set e abre o seguinte', () => {
    const score = computeLiveScore(rally(1, 21))
    expect(score.sets).toEqual([{ score1: 21, score2: 0 }])
    expect(score.currentSet).toEqual({ setNumber: 2, score1: 0, score2: 0 })
    expect(score.setsWon).toEqual({ side1: 1, side2: 0 })
    expect(score.winner).toBeNull()
  })

  it('decide em 2 sets (2-0)', () => {
    const score = computeLiveScore([...rally(2, 21), ...rally(2, 21)])
    expect(score.winner).toBe(2)
    expect(score.currentSet).toBeNull()
    expect(score.sets).toHaveLength(2)
  })

  it('vai ao terceiro set e decide (2-1)', () => {
    const score = computeLiveScore([...rally(1, 21), ...rally(2, 21), ...setPoints(21, 19)])
    expect(score.winner).toBe(1)
    expect(score.setsWon).toEqual({ side1: 2, side2: 1 })
    expect(score.sets[2]).toEqual({ score1: 21, score2: 19 })
  })

  it('respeita vantagem e limite de 30 no mesmo set', () => {
    const deuce = setPoints(20, 20)
    expect(computeLiveScore([...deuce, 1]).currentSet).toMatchObject({ score1: 21, score2: 20 })
    expect(computeLiveScore([...deuce, 1, 1]).sets[0]).toEqual({ score1: 22, score2: 20 })

    const alternated: Side[] = [...deuce]
    for (let i = 0; i < 9; i++) alternated.push(1, 2)
    expect(computeLiveScore(alternated).currentSet).toMatchObject({ score1: 29, score2: 29 })
    expect(computeLiveScore([...alternated, 2]).sets[0]).toEqual({ score1: 29, score2: 30 })
  })

  it('ignora pontos depois da vitória', () => {
    const score = computeLiveScore([...rally(1, 21), ...rally(1, 21), 2, 2])
    expect(score.winner).toBe(1)
    expect(score.sets).toEqual([
      { score1: 21, score2: 0 },
      { score1: 21, score2: 0 },
    ])
  })

  it('desfazer o último ponto reabre o set decisivo', () => {
    const points = [...rally(1, 21), ...rally(1, 21)]
    expect(computeLiveScore(points).winner).toBe(1)
    const undone = computeLiveScore(points.slice(0, -1))
    expect(undone.winner).toBeNull()
    expect(undone.currentSet).toEqual({ setNumber: 2, score1: 20, score2: 0 })
  })
})

describe('canAddPoint / toResultSets', () => {
  it('recusa ponto com a partida decidida', () => {
    expect(canAddPoint([1])).toBe(true)
    expect(canAddPoint([...rally(1, 21), ...rally(1, 21)])).toBe(false)
  })

  it('converte para o formato de match_results', () => {
    const score = computeLiveScore([...rally(1, 21), ...rally(2, 21), ...setPoints(19, 21)])
    expect(toResultSets(score)).toEqual([
      { setNumber: 1, score1: 21, score2: 0 },
      { setNumber: 2, score1: 0, score2: 21 },
      { setNumber: 3, score1: 19, score2: 21 },
    ])
  })
})
