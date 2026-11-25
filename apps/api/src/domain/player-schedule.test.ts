import { describe, expect, it } from 'vitest'
import type { MatchDef } from './bracket.js'
import { buildRoundRobinMatchDefs } from './round-robin.js'
import { buildSwissRoundDefs } from './swiss.js'
import { buildPlayerSchedule, nextPlayerMatch, type PlayerMatch, type ScheduleMatchInput } from './player-schedule.js'

// Chave de 8 com 6 inscritos (rodada 3 = quartas, 2 = semi, 1 = final). "me" tem bye nas quartas.
const m = (over: Partial<ScheduleMatchInput> & Pick<ScheduleMatchInput, 'id' | 'round' | 'position'>): ScheduleMatchInput => ({
  categoryId: 'cat',
  categoryName: 'Simples Masculino',
  roundLabel: null,
  status: 'pending',
  registration1Id: null,
  registration2Id: null,
  nextMatchId: null,
  scheduledAt: null,
  courtNumber: null,
  ...over,
})

const names: Record<string, string> = { me: 'Eu Mesmo', a: 'Ana', b: 'Bruno', c: 'Caio', d: 'Davi', e: 'Edu' }
const nameOf = (id: string) => names[id] ?? null

describe('buildPlayerSchedule', () => {
  const bracket = [
    m({ id: 'q1', round: 3, position: 1, status: 'walkover', registration1Id: 'me', nextMatchId: 's1' }),
    m({ id: 'q2', round: 3, position: 2, registration1Id: 'a', registration2Id: 'b', nextMatchId: 's1' }),
    m({ id: 'q3', round: 3, position: 3, registration1Id: 'c', registration2Id: 'd', nextMatchId: 's2' }),
    m({ id: 's1', round: 2, position: 1, registration1Id: 'me', nextMatchId: 'f', courtNumber: 3, scheduledAt: '2099-01-01T12:00:00.000Z' }),
    m({ id: 's2', round: 2, position: 2, registration2Id: 'e', nextMatchId: 'f' }),
    m({ id: 'f', round: 1, position: 1 }),
  ]

  it('lista o bye (avança direto) e a partida a jogar, com a próxima se vencer', () => {
    const list = buildPlayerSchedule(bracket, new Set(['me']), nameOf, () => [])
    expect(list.map((p) => [p.matchId, p.kind, p.roundLabel])).toEqual([
      ['q1', 'bye', 'Quartas de final'],
      ['s1', 'upcoming', 'Semifinal'],
    ])
    expect(list[0]).toMatchObject({ opponent: null, result: 'won', score: null, ifWin: null })
    // Adversário da semi ainda a definir: o vencedor de Ana × Bruno; na final, a outra semi só tem o Edu.
    expect(list[1]).toMatchObject({
      opponent: 'vencedor de Ana × Bruno', opponentKnown: false, courtNumber: 3,
      ifWin: { roundLabel: 'Final', opponent: 'vencedor do jogo de Edu' },
    })
  })

  it('sem ninguém conhecido do outro lado, o adversário é null (a definir)', () => {
    const empty = bracket.map((x) => (x.id === 's2' ? { ...x, registration2Id: null } : x))
    expect(buildPlayerSchedule(empty, new Set(['me']), nameOf, () => [])[1]!.ifWin).toEqual({ roundLabel: 'Final', opponent: null })
  })

  it('na próxima se vencer, usa o adversário já definido ou "vencedor de" da outra partida', () => {
    const live = bracket.map((x) => (x.id === 's1' ? { ...x, registration2Id: 'a', status: 'in_progress' } : x))
    const [, semi] = buildPlayerSchedule(live, new Set(['me']), nameOf, () => [])
    expect(semi).toMatchObject({ kind: 'live', opponent: 'Ana', opponentKnown: true, ifWin: { roundLabel: 'Final', opponent: 'vencedor do jogo de Edu' } })

    // Quando a outra semi já tem os dois lados, a final mostra "vencedor de Caio × Edu".
    const filled = live.map((x) => (x.id === 's2' ? { ...x, registration1Id: 'c' } : x))
    expect(buildPlayerSchedule(filled, new Set(['me']), nameOf, () => [])[1]!.ifWin).toEqual({ roundLabel: 'Final', opponent: 'vencedor de Caio × Edu' })

    // Quando o adversário da final já está lá, é o nome dele.
    const known = filled.map((x) => (x.id === 'f' ? { ...x, registration2Id: 'c' } : x))
    expect(buildPlayerSchedule(known, new Set(['me']), nameOf, () => [])[1]!.ifWin).toEqual({ roundLabel: 'Final', opponent: 'Caio' })
  })

  it('partida jogada traz resultado e placar do ponto de vista do jogador, sem próxima condicional', () => {
    const played = bracket.map((x) => (x.id === 's1' ? { ...x, registration2Id: 'a', status: 'completed' } : x))
    const sets = (id: string) => (id === 's1' ? [{ score1: 21, score2: 15 }, { score1: 19, score2: 21 }, { score1: 21, score2: 18 }] : [])
    expect(buildPlayerSchedule(played, new Set(['me']), nameOf, sets)[1]).toMatchObject({ kind: 'played', result: 'won', score: '21-15 19-21 21-18', ifWin: null })
    // Do lado 2, o placar é invertido e o resultado também.
    expect(buildPlayerSchedule(played, new Set(['a']), nameOf, sets).find((p) => p.matchId === 's1')).toMatchObject({ result: 'lost', score: '15-21 21-19 18-21' })
  })

  it('todos contra todos (gerador real): Rodada 1 primeiro, sem "se vencer"', () => {
    const rr = buildRoundRobinMatchDefs('d', ['me', 'a', 'b', 'c']).map((d) => fromDef(d, 'Dupla Mista'))
    const list = buildPlayerSchedule(rr, new Set(['me']), nameOf, () => [])
    expect(list.map((p) => p.roundLabel)).toEqual(['Rodada 1', 'Rodada 2', 'Rodada 3'])
    expect(list.every((p) => p.ifWin === null && p.kind === 'upcoming')).toBe(true)
  })

  it('folga do suíço (gerador real) é "rest", não bye de eliminatória', () => {
    const swiss = buildSwissRoundDefs('d', 3, 1, { pairs: [['a', 'b']], bye: 'me', rematches: 0 }).map((d) => fromDef(d, 'Simples'))
    expect(buildPlayerSchedule(swiss, new Set(['me']), nameOf, () => [])).toEqual([
      expect.objectContaining({ kind: 'rest', roundLabel: 'Rodada 1', opponent: null, result: 'won' }),
    ])
  })

  it('dupla eliminação: o lado que espera o perdedor de outra partida diz "perdedor de"', () => {
    const de = [
      m({ id: 'w1', round: 3, position: 1, registration1Id: 'a', registration2Id: 'b', loserNextMatchId: 'l1' }),
      m({ id: 'l1', round: 2, position: 1, roundLabel: 'Perdedores 1', registration1Id: 'me' }),
    ]
    expect(buildPlayerSchedule(de, new Set(['me']), nameOf, () => [])[0]!.opponent).toBe('perdedor de Ana × Bruno')
  })

  it('categorias em ordem alfabética, cada uma na ordem de jogo', () => {
    const rr = buildRoundRobinMatchDefs('d', ['pair', 'x']).map((d) => fromDef(d, 'Dupla Mista'))
    const list = buildPlayerSchedule([...bracket, ...rr], new Set(['me', 'pair']), (id) => (id === 'x' ? 'Xis / Ypsilon' : nameOf(id)), () => [])
    expect(list.map((p) => p.categoryName)).toEqual(['Dupla Mista', 'Simples Masculino', 'Simples Masculino'])
    expect(list[0]).toMatchObject({ opponent: 'Xis / Ypsilon', ifWin: null })
  })
})

function fromDef(d: MatchDef, categoryName: string): ScheduleMatchInput {
  return {
    id: d.id, categoryId: categoryName, categoryName, round: d.round, position: d.position, roundLabel: d.roundLabel ?? null, status: d.status,
    registration1Id: d.registration1Id, registration2Id: d.registration2Id, nextMatchId: d.nextMatchId,
    loserNextMatchId: d.loserNextMatchId ?? null, scheduledAt: null, courtNumber: null,
  }
}

describe('nextPlayerMatch', () => {
  const p = (matchId: string, kind: PlayerMatch['kind'], scheduledAt: string | null = null): PlayerMatch => ({
    matchId, kind, scheduledAt, categoryId: 'c', categoryName: 'c', roundLabel: 'r', opponent: null, opponentKnown: false, result: null, score: null, courtNumber: null, ifWin: null,
  })
  it('ao vivo primeiro; senão a de horário mais cedo; sem horário, a primeira da lista', () => {
    expect(nextPlayerMatch([p('a', 'upcoming', '2099-01-01T10:00:00Z'), p('b', 'live')])).toBe('b')
    expect(nextPlayerMatch([p('a', 'upcoming', '2099-01-01T12:00:00Z'), p('b', 'upcoming', '2099-01-01T09:00:00Z')])).toBe('b')
    expect(nextPlayerMatch([p('a', 'bye'), p('b', 'upcoming'), p('c', 'upcoming')])).toBe('b')
    expect(nextPlayerMatch([p('a', 'played')])).toBeNull()
  })
})
