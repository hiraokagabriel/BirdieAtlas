import { describe, expect, it } from 'vitest'
import { buildAttentionItems, type AttentionInput } from './attention.js'

function input(over: Partial<AttentionInput> = {}): AttentionInput {
  return {
    tournaments: [],
    categories: [],
    draws: [],
    pendingByCategory: new Map(),
    approvedByCategory: new Map(),
    ...over,
  }
}

const open = { id: 't1', name: 'Open', status: 'registration_open' }
const closed = { id: 't2', name: 'Copa', status: 'registration_closed' }

describe('buildAttentionItems', () => {
  it('soma as inscrições pendentes das categorias de cada torneio', () => {
    const items = buildAttentionItems(input({
      tournaments: [open],
      categories: [{ id: 'c1', tournamentId: 't1', name: 'SM' }, { id: 'c2', tournamentId: 't1', name: 'SF' }],
      pendingByCategory: new Map([['c1', 3], ['c2', 1]]),
    }))
    expect(items).toEqual([{ kind: 'pending_registrations', tournamentId: 't1', tournamentName: 'Open', count: 4 }])
  })

  it('sem pendências não gera item', () => {
    expect(buildAttentionItems(input({ tournaments: [open], categories: [{ id: 'c1', tournamentId: 't1', name: 'SM' }] }))).toEqual([])
  })

  it('com inscrições abertas não cobra chave', () => {
    const items = buildAttentionItems(input({
      tournaments: [open],
      categories: [{ id: 'c1', tournamentId: 't1', name: 'SM' }],
      approvedByCategory: new Map([['c1', 8]]),
    }))
    expect(items).toEqual([])
  })

  it('depois das inscrições, conta as categorias sem chave com 2 ou mais aprovados', () => {
    const items = buildAttentionItems(input({
      tournaments: [closed],
      categories: [
        { id: 'c1', tournamentId: 't2', name: 'SM' },
        { id: 'c2', tournamentId: 't2', name: 'SF' },
        { id: 'c3', tournamentId: 't2', name: 'DM' },
      ],
      approvedByCategory: new Map([['c1', 2], ['c2', 1], ['c3', 6]]),
    }))
    expect(items).toEqual([{ kind: 'missing_draws', tournamentId: 't2', tournamentName: 'Copa', count: 2 }])
  })

  it('conta as categorias com chave gerada e não publicada; publicada não conta', () => {
    const items = buildAttentionItems(input({
      tournaments: [closed],
      categories: [{ id: 'c1', tournamentId: 't2', name: 'SM' }, { id: 'c2', tournamentId: 't2', name: 'DM' }],
      draws: [{ categoryId: 'c1', published: false }, { categoryId: 'c2', published: true }],
    }))
    expect(items).toEqual([{ kind: 'unpublished_draws', tournamentId: 't2', tournamentName: 'Copa', count: 1 }])
  })

  it('uma chave publicada basta, mesmo com outra não publicada na categoria', () => {
    const items = buildAttentionItems(input({
      tournaments: [closed],
      categories: [{ id: 'c1', tournamentId: 't2', name: 'SM' }],
      draws: [{ categoryId: 'c1', published: false }, { categoryId: 'c1', published: true }],
    }))
    expect(items).toEqual([])
  })

  it('em andamento também cobra chave', () => {
    const items = buildAttentionItems(input({
      tournaments: [{ id: 't3', name: 'Liga', status: 'in_progress' }],
      categories: [{ id: 'c1', tournamentId: 't3', name: 'SM' }],
      approvedByCategory: new Map([['c1', 4]]),
    }))
    expect(items).toEqual([{ kind: 'missing_draws', tournamentId: 't3', tournamentName: 'Liga', count: 1 }])
  })

  it('ordena por torneio: inscrições, categorias sem chave, chaves não publicadas', () => {
    const items = buildAttentionItems(input({
      tournaments: [closed, open],
      categories: [
        { id: 'c1', tournamentId: 't2', name: 'SM' },
        { id: 'c2', tournamentId: 't2', name: 'DM' },
        { id: 'c9', tournamentId: 't1', name: 'XD' },
      ],
      draws: [{ categoryId: 'c2', published: false }],
      pendingByCategory: new Map([['c1', 1], ['c9', 2]]),
      approvedByCategory: new Map([['c1', 4]]),
    }))
    expect(items.map((i) => `${i.tournamentId}:${i.kind}`)).toEqual([
      't2:pending_registrations',
      't2:missing_draws',
      't2:unpublished_draws',
      't1:pending_registrations',
    ])
  })
})
