import { describe, expect, it } from 'vitest'
import { computePlacements } from '../domain/placements.js'
import { computeLiveScore } from '../domain/live-score.js'
import { isPendingMatch } from './ranking-engine.js'

// Placar provisório (match_live_states) nunca vira resultado: colocação, pontos e encerramento só
// leem match_results e o status final da partida.

describe('invariantes do placar ao vivo', () => {
  it('partida em andamento continua pendente para o ranking e o encerramento', () => {
    expect(isPendingMatch({ status: 'in_progress', registration1Id: 'a', registration2Id: 'b' })).toBe(true)
    expect(isPendingMatch({ status: 'completed', registration1Id: 'a', registration2Id: 'b' })).toBe(false)
  })

  it('placar provisório decidido não gera colocação enquanto não há sets em match_results', () => {
    const live = computeLiveScore([...Array<1>(21).fill(1), ...Array<1>(21).fill(1)])
    expect(live.winner).toBe(1)

    const final = { id: 'final', round: 1, registration1Id: 'a', registration2Id: 'b' }
    // O motor só recebe sets de match_results: partida em andamento chega sem sets.
    expect(computePlacements([final], new Map())).toEqual(new Map())
    expect(computePlacements([final], new Map([['final', live.sets]])).get('a')).toBe(1)
  })
})
