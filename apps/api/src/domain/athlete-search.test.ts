import { describe, expect, it } from 'vitest'
import {
  ACCENTED_CHARS,
  PLAIN_CHARS,
  athleteSearchQuerySchema,
  escapeLike,
  normalizeSearchText,
  toSearchPatterns,
} from './athlete-search.js'

describe('athlete search', () => {
  it('normaliza caixa e acentos', () => {
    expect(normalizeSearchText('  JOSÉ Conceição ')).toBe('jose conceicao')
  })

  it('tabelas de translate têm o mesmo tamanho', () => {
    expect([...ACCENTED_CHARS].length).toBe([...PLAIN_CHARS].length)
  })

  it('escapa curingas do LIKE', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b')
    expect(toSearchPatterns('%')).toEqual(['%\\%%'])
  })

  it('gera um padrão por termo, limitado', () => {
    expect(toSearchPatterns('José  Silva')).toEqual(['%jose%', '%silva%'])
    expect(toSearchPatterns('a b c d e f g')).toHaveLength(5)
  })

  it('valida a query', () => {
    expect(athleteSearchQuerySchema.parse({ q: '  jo ' })).toEqual({ q: 'jo', page: 1, pageSize: 10 })
    expect(athleteSearchQuerySchema.safeParse({ q: 'j' }).success).toBe(false)
    expect(athleteSearchQuerySchema.safeParse({ q: '   ' }).success).toBe(false)
    expect(athleteSearchQuerySchema.safeParse({}).success).toBe(false)
    expect(athleteSearchQuerySchema.safeParse({ q: 'x'.repeat(81) }).success).toBe(false)
    expect(athleteSearchQuerySchema.safeParse({ q: 'jo', pageSize: '26' }).success).toBe(false)
    expect(athleteSearchQuerySchema.parse({ q: 'jo', pageSize: '25', page: '2' }).page).toBe(2)
  })
})
