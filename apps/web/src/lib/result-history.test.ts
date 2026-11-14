import { describe, expect, it } from 'vitest'
import { describeResultEvent, resultSourceLabel, type ResultEvent } from './result-history'

const base: ResultEvent = {
  id: 'e1',
  matchId: 'm1',
  source: 'dialog',
  courtNumber: 2,
  previousStatus: 'pending',
  previousSets: [],
  nextStatus: 'completed',
  nextSets: [{ setNumber: 2, score1: 21, score2: 18 }, { setNumber: 1, score1: 21, score2: 15 }],
  resetMatchCount: 0,
  createdAt: '2026-11-14T12:00:00.000Z',
}

describe('describeResultEvent', () => {
  it('primeiro resultado: antes sem resultado, depois os sets em ordem', () => {
    expect(describeResultEvent(base)).toEqual({ before: 'sem resultado', after: '21-15 21-18', cascade: null })
  })

  it('correção que trocou o vencedor: status fora de concluída aparece e a cascata é contada', () => {
    const changed = { ...base, previousStatus: 'completed', previousSets: base.nextSets, nextStatus: 'walkover', nextSets: [{ setNumber: 1, score1: 0, score2: 21 }], resetMatchCount: 2 }
    expect(describeResultEvent(changed)).toEqual({ before: '21-15 21-18', after: '0-21 (W.O.)', cascade: 'Desfez 2 partidas seguintes' })
    expect(describeResultEvent({ ...changed, resetMatchCount: 1 }).cascade).toBe('Desfez 1 partida seguinte')
  })
})

describe('resultSourceLabel', () => {
  it('diálogo do admin, ou a quadra ao vivo', () => {
    expect(resultSourceLabel(base)).toBe('Diálogo de resultado')
    expect(resultSourceLabel({ source: 'live', courtNumber: 3 })).toBe('Quadra 3 (ao vivo)')
    expect(resultSourceLabel({ source: 'live', courtNumber: null })).toBe('Ao vivo')
  })
})
