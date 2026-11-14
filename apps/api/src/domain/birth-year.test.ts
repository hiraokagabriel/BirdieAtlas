import { describe, expect, it } from 'vitest'
import { birthYearSchema, optionalBirthYearSchema } from './birth-year.js'

const now = new Date('2026-11-14T12:00:00Z')

describe('birthYearSchema', () => {
  it('aceita de 1900 até o ano corrente, também como texto', () => {
    expect(birthYearSchema(now).parse(1900)).toBe(1900)
    expect(birthYearSchema(now).parse('2026')).toBe(2026)
  })

  it('recusa fora da faixa, fracionado e data completa', () => {
    expect(birthYearSchema(now).safeParse(1899).success).toBe(false)
    expect(birthYearSchema(now).safeParse(2027).success).toBe(false)
    expect(birthYearSchema(now).safeParse(1995.5).success).toBe(false)
    expect(birthYearSchema(now).safeParse('1995-03-20').success).toBe(false)
  })
})

describe('optionalBirthYearSchema', () => {
  it('vazio e ausente viram null', () => {
    expect(optionalBirthYearSchema(now).parse('')).toBeNull()
    expect(optionalBirthYearSchema(now).parse(undefined)).toBeNull()
    expect(optionalBirthYearSchema(now).parse(null)).toBeNull()
    expect(optionalBirthYearSchema(now).parse('1998')).toBe(1998)
  })
})
