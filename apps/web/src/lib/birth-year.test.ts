import { describe, expect, it } from 'vitest'
import { ageFromBirthYear, birthYearError } from './birth-year'

const now = new Date('2026-11-14T12:00:00Z')

describe('ageFromBirthYear', () => {
  it('ano corrente menos o ano; sem ano, traço', () => {
    expect(ageFromBirthYear(2000, now)).toBe('26 anos')
    expect(ageFromBirthYear(null, now)).toBe('—')
  })
})

describe('birthYearError', () => {
  it('vazio é válido; fora da faixa ou sem 4 dígitos, erro', () => {
    expect(birthYearError('', now)).toBeNull()
    expect(birthYearError(' 1998 ', now)).toBeNull()
    expect(birthYearError('1899', now)).toMatch(/entre 1900 e 2026/)
    expect(birthYearError('2027', now)).not.toBeNull()
    expect(birthYearError('98', now)).not.toBeNull()
    expect(birthYearError('1995-03-20', now)).not.toBeNull()
  })
})
