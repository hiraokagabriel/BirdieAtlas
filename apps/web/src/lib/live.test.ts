import { describe, expect, it } from 'vitest'
import {
  FALLBACK_AFTER_FAILURES,
  asLiveMatch,
  backoffDelay,
  formatLiveScore,
  knownCourts,
  liveAnnouncements,
  liveOnCourt,
  liveReducer,
  parseLiveEvent,
  queueOnCourt,
  shouldFallBackToPolling,
  sortLive,
  type LiveMatch,
  type QueueMatch,
} from './live'

function match(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    matchId: 'm1',
    tournamentId: 't1',
    categoryId: 'c1',
    categoryName: 'Simples Masculino',
    discipline: 'MS',
    drawId: 'd1',
    round: 3,
    roundLabel: 'Quartas de final',
    position: 1,
    courtNumber: 1,
    scheduledAt: null,
    status: 'in_progress',
    participant1: 'Ana Souza',
    participant2: 'Bia Lima',
    sets: [],
    currentSet: { setNumber: 1, score1: 0, score2: 0 },
    setsWon: { side1: 0, side2: 0 },
    winner: null,
    version: 0,
    updatedAt: '2026-10-24T12:00:00.000Z',
    ...overrides,
  }
}

describe('liveReducer', () => {
  it('snapshot substitui a lista, ordenada por quadra', () => {
    const state = liveReducer([match({ matchId: 'old' })], {
      type: 'snapshot',
      matches: [match({ matchId: 'b', courtNumber: 2 }), match({ matchId: 'a', courtNumber: 1 })],
    })
    expect(state.map((m) => m.matchId)).toEqual(['a', 'b'])
  })

  it('match insere e atualiza pela partida', () => {
    let state = liveReducer([], { type: 'match', match: match() })
    expect(state).toHaveLength(1)
    state = liveReducer(state, { type: 'match', match: match({ version: 1, currentSet: { setNumber: 1, score1: 1, score2: 0 } }) })
    expect(state).toHaveLength(1)
    expect(state[0]?.currentSet?.score1).toBe(1)
  })

  it('ignora evento com versão mais antiga que a atual', () => {
    const state = liveReducer([match({ version: 5 })], { type: 'match', match: match({ version: 3 }) })
    expect(state[0]?.version).toBe(5)
  })

  it('match-ended remove a partida', () => {
    const state = liveReducer([match(), match({ matchId: 'm2' })], { type: 'match-ended', matchId: 'm1', reason: 'finished' })
    expect(state.map((m) => m.matchId)).toEqual(['m2'])
  })

  it('não altera o estado recebido', () => {
    const original = [match()]
    liveReducer(original, { type: 'match-ended', matchId: 'm1', reason: 'cancelled' })
    expect(original).toHaveLength(1)
  })
})

describe('sortLive', () => {
  it('coloca partidas sem quadra por último e desempata por horário', () => {
    const sorted = sortLive([
      match({ matchId: 'x', courtNumber: null }),
      match({ matchId: 'b', courtNumber: 1, scheduledAt: '2026-10-24T13:00:00.000Z' }),
      match({ matchId: 'a', courtNumber: 1, scheduledAt: '2026-10-24T12:00:00.000Z' }),
    ])
    expect(sorted.map((m) => m.matchId)).toEqual(['a', 'b', 'x'])
  })
})

describe('parseLiveEvent', () => {
  it('lê snapshot, match e match-ended', () => {
    expect(parseLiveEvent('snapshot', JSON.stringify({ matches: [match()] }))).toEqual({ type: 'snapshot', matches: [match()] })
    expect(parseLiveEvent('match', JSON.stringify({ match: match() }))).toEqual({ type: 'match', match: match() })
    expect(parseLiveEvent('match-ended', JSON.stringify({ matchId: 'm1', reason: 'finished' }))).toEqual({
      type: 'match-ended',
      matchId: 'm1',
      reason: 'finished',
    })
  })

  it('descarta JSON inválido, evento desconhecido e formato errado', () => {
    expect(parseLiveEvent('snapshot', '{oops')).toBeNull()
    expect(parseLiveEvent('ready', '{}')).toBeNull()
    expect(parseLiveEvent('snapshot', JSON.stringify({ matches: [{ matchId: 1 }] }))).toBeNull()
    expect(parseLiveEvent('match-ended', JSON.stringify({ matchId: 'm1', reason: 'x' }))).toBeNull()
    expect(parseLiveEvent('match', '"texto"')).toBeNull()
  })
})

describe('asLiveMatch', () => {
  it('aceita uma partida válida e recusa o resto', () => {
    expect(asLiveMatch(match())).toEqual(match())
    expect(asLiveMatch(null)).toBeNull()
    expect(asLiveMatch({ matchId: 'x' })).toBeNull()
  })
})

describe('backoffDelay', () => {
  it('dobra a cada tentativa até o teto, com jitter de 50% a 100%', () => {
    const max = () => 1
    const min = () => 0
    expect(backoffDelay(1, { random: max })).toBe(1000)
    expect(backoffDelay(2, { random: max })).toBe(2000)
    expect(backoffDelay(3, { random: max })).toBe(4000)
    expect(backoffDelay(1, { random: min })).toBe(500)
    expect(backoffDelay(3, { random: min })).toBe(2000)
  })

  it('respeita o teto', () => {
    expect(backoffDelay(30, { random: () => 1 })).toBe(30_000)
    expect(backoffDelay(30, { maxMs: 5_000, random: () => 0 })).toBe(2_500)
  })

  it('trata tentativa 0 ou negativa como a primeira', () => {
    expect(backoffDelay(0, { random: () => 1 })).toBe(1000)
    expect(backoffDelay(-3, { random: () => 1 })).toBe(1000)
  })
})

describe('shouldFallBackToPolling', () => {
  it('cai para polling depois de falhas seguidas', () => {
    expect(shouldFallBackToPolling(FALLBACK_AFTER_FAILURES - 1)).toBe(false)
    expect(shouldFallBackToPolling(FALLBACK_AFTER_FAILURES)).toBe(true)
  })
})

describe('liveAnnouncements', () => {
  it('não anuncia pontos soltos', () => {
    const prev = [match()]
    const next = [match({ version: 1, currentSet: { setNumber: 1, score1: 7, score2: 5 } })]
    expect(liveAnnouncements(prev, next)).toEqual([])
  })

  it('anuncia início, fim de set, vitória e fim da partida', () => {
    const started = liveAnnouncements([], [match()])
    expect(started).toEqual(['Partida iniciada na quadra 1: Ana Souza x Bia Lima.'])

    const setDone = match({
      version: 21,
      sets: [{ score1: 21, score2: 15 }],
      currentSet: { setNumber: 2, score1: 0, score2: 0 },
      setsWon: { side1: 1, side2: 0 },
    })
    expect(liveAnnouncements([match()], [setDone])[0]).toContain('Fim do set 1 na quadra 1: 21 a 15')

    const decided = match({
      version: 42,
      sets: [{ score1: 21, score2: 15 }, { score1: 21, score2: 18 }],
      currentSet: null,
      setsWon: { side1: 2, side2: 0 },
      winner: 1,
    })
    expect(liveAnnouncements([setDone], [decided])).toEqual([
      'Fim de jogo na quadra 1: Ana Souza venceu por 2 sets a 0. Placar 21-15 · 21-18.',
    ])

    expect(liveAnnouncements([decided], [])).toEqual(['Partida encerrada: Ana Souza x Bia Lima.'])
  })
})

describe('formatLiveScore', () => {
  it('junta sets encerrados e o set em disputa', () => {
    expect(formatLiveScore({ sets: [{ score1: 21, score2: 15 }], currentSet: { setNumber: 2, score1: 10, score2: 8 } })).toBe('21-15 · 10-8')
    expect(formatLiveScore({ sets: [{ score1: 21, score2: 15 }], currentSet: null })).toBe('21-15')
  })
})

describe('quadras do operador', () => {
  const queue: QueueMatch[] = [
    { matchId: 'q1', tournamentId: 't1', categoryId: 'c', categoryName: 'MS', discipline: 'MS', drawId: 'd', round: 3, roundLabel: 'Quartas', position: 1, courtNumber: 2, scheduledAt: null, participant1: 'A', participant2: 'B' },
    { matchId: 'q2', tournamentId: 't1', categoryId: 'c', categoryName: 'MS', discipline: 'MS', drawId: 'd', round: 3, roundLabel: 'Quartas', position: 2, courtNumber: null, scheduledAt: null, participant1: 'C', participant2: 'D' },
  ]

  it('lista quadras sem repetir, em ordem, ignorando partidas sem quadra', () => {
    expect(knownCourts([match({ courtNumber: 3 })], queue)).toEqual([2, 3])
  })

  it('separa ao vivo e fila por quadra (null = sem quadra)', () => {
    expect(liveOnCourt([match({ courtNumber: 3 })], 3)?.matchId).toBe('m1')
    expect(liveOnCourt([match({ courtNumber: 3 })], 1)).toBeUndefined()
    expect(queueOnCourt(queue, 2).map((m) => m.matchId)).toEqual(['q1'])
    expect(queueOnCourt(queue, null).map((m) => m.matchId)).toEqual(['q2'])
  })
})
