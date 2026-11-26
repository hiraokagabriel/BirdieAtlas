import { describe, expect, it } from 'vitest'
import { categoryChangeBlock } from './category-config.js'

const fresh = { hasDraw: false, hasPlayedMatch: false, activeRegistrations: 0 }

describe('categoryChangeBlock', () => {
  it('categoria nova muda tudo e pode ser excluída', () => {
    expect(categoryChangeBlock(fresh, { drawType: true, scoring: true, maxEntries: 8 })).toBeNull()
    expect(categoryChangeBlock(fresh, { delete: true })).toBeNull()
  })

  it('formato trava com chave; pontuação só com resultado', () => {
    const drawn = { ...fresh, hasDraw: true, activeRegistrations: 8 }
    expect(categoryChangeBlock(drawn, { drawType: true })?.code).toBe('CATEGORY_HAS_DRAW')
    expect(categoryChangeBlock(drawn, { scoring: true })).toBeNull()
    expect(categoryChangeBlock({ ...drawn, hasPlayedMatch: true }, { scoring: true })?.code).toBe('CATEGORY_HAS_RESULTS')
  })

  it('excluir exige sem chave e sem inscrições', () => {
    expect(categoryChangeBlock({ ...fresh, hasDraw: true }, { delete: true })?.code).toBe('CATEGORY_HAS_DRAW')
    expect(categoryChangeBlock({ ...fresh, activeRegistrations: 2 }, { delete: true })?.code).toBe('CATEGORY_HAS_REGISTRATIONS')
  })

  it('limite não fica abaixo das inscrições; null remove o limite', () => {
    const s = { ...fresh, activeRegistrations: 6 }
    expect(categoryChangeBlock(s, { maxEntries: 4 })?.code).toBe('MAX_ENTRIES_BELOW_REGISTRATIONS')
    expect(categoryChangeBlock(s, { maxEntries: 6 })).toBeNull()
    expect(categoryChangeBlock(s, { maxEntries: null })).toBeNull()
  })
})
