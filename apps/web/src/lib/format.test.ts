import { describe, expect, it } from 'vitest'
import { countryName, formatDate, formatDateRange, initials } from './format'

describe('format', () => {
  it('formata datas em UTC sem deslocar o dia', () => {
    expect(formatDate('2026-09-05')).toBe('05/09/2026')
    expect(formatDate('inválida')).toBe('—')
  })

  it('colapsa intervalo de um dia só', () => {
    expect(formatDateRange('2026-09-05', '2026-09-05')).toBe('05/09/2026')
    expect(formatDateRange('2026-09-05', '2026-09-07')).toBe('05/09/2026 – 07/09/2026')
  })

  it('gera iniciais com até duas letras', () => {
    expect(initials('maria da silva')).toBe('MD')
    expect(initials('  Ana ')).toBe('A')
    expect(initials('')).toBe('')
  })

  it('traduz o país e cai no código quando desconhecido', () => {
    expect(countryName('BR')).toBe('Brasil')
    expect(countryName('xx-invalid')).toBe('xx-invalid')
  })
})
