import { describe, expect, it } from 'vitest'
import { selectLiveBoards, selectRecent, selectUpcoming, type TournamentSummary } from './home-data'

function t(id: string, status: string, startDate: string, endDate = startDate): TournamentSummary {
  return { id, name: id, slug: id, status, level: 'state', startDate, endDate, city: null, state: null }
}

describe('selectUpcoming', () => {
  it('ordena por status e depois por data, ignorando encerrados, cancelados e rascunhos', () => {
    const result = selectUpcoming(
      [
        t('done', 'completed', '2026-01-01'),
        t('cancelled', 'cancelled', '2026-12-01'),
        t('draft', 'draft', '2026-12-02'),
        t('open-late', 'registration_open', '2026-11-20'),
        t('live', 'in_progress', '2026-09-05'),
        t('open-soon', 'registration_open', '2026-11-01'),
        t('closed', 'registration_closed', '2026-10-30'),
      ],
      10,
    )
    expect(result.map((x) => x.id)).toEqual(['live', 'open-soon', 'open-late', 'closed'])
  })

  it('respeita o limite', () => {
    const list = [t('a', 'in_progress', '2026-01-01'), t('b', 'in_progress', '2026-01-02')]
    expect(selectUpcoming(list, 1)).toHaveLength(1)
  })
})

describe('selectRecent', () => {
  it('só encerrados, o mais recente primeiro', () => {
    const result = selectRecent(
      [
        t('old', 'completed', '2025-01-01', '2025-01-02'),
        t('new', 'completed', '2026-03-01', '2026-03-03'),
        t('live', 'in_progress', '2026-09-01'),
      ],
      5,
    )
    expect(result.map((x) => x.id)).toEqual(['new', 'old'])
  })
})

describe('selectLiveBoards', () => {
  const on = (n: number) => ({ live: { ok: true as const, data: Array.from({ length: n }, (_, i) => i) } })
  const failed = { live: { ok: false as const } }

  it('aplica o limite depois de descartar os torneios sem partida em quadra', () => {
    const result = selectLiveBoards([on(0), on(0), on(2), on(1)], 2)
    expect(result).toEqual([on(2), on(1)])
  })

  it('mantém o torneio cujo placar falhou, para a home mostrar o erro', () => {
    expect(selectLiveBoards([on(0), failed], 2)).toEqual([failed])
  })

  it('devolve vazio sem nenhuma partida em quadra', () => {
    expect(selectLiveBoards([on(0)], 2)).toEqual([])
  })
})
