import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeText } from './search'

describe('search', () => {
  it('ignora acentos e caixa', () => {
    expect(normalizeText('  JOSÉ Conceição ')).toBe('jose conceicao')
    expect(matchesQuery('José da Silva', 'jose')).toBe(true)
  })

  it('exige todos os termos, em qualquer ordem', () => {
    expect(matchesQuery('Associação Badminton SP', 'sp badminton')).toBe(true)
    expect(matchesQuery('Associação Badminton SP', 'badminton rj')).toBe(false)
  })

  it('consulta vazia não encontra nada', () => {
    expect(matchesQuery('qualquer coisa', '   ')).toBe(false)
  })
})
