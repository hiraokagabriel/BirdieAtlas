import { describe, expect, it } from 'vitest'
import {
  CSV_BOM,
  buildCsv,
  csvAttachmentHeader,
  escapeCsvField,
  formatCsvCell,
  neutralizeFormula,
  slugifyFilename,
} from './csv.js'

describe('neutralizeFormula', () => {
  it.each(['=1+1', '+55', '-2', '@SUM(A1)', '\tcmd', '\rcmd'])('prefixes %j with an apostrophe', (text) => {
    expect(neutralizeFormula(text)).toBe(`'${text}`)
  })

  it('leaves safe text alone', () => {
    expect(neutralizeFormula('Maria')).toBe('Maria')
    expect(neutralizeFormula('a=b')).toBe('a=b')
    expect(neutralizeFormula('')).toBe('')
  })
})

describe('escapeCsvField', () => {
  it('quotes fields with the delimiter, quotes or line breaks', () => {
    expect(escapeCsvField('a;b')).toBe('"a;b"')
    expect(escapeCsvField('linha1\nlinha2')).toBe('"linha1\nlinha2"')
    expect(escapeCsvField('linha1\r\nlinha2')).toBe('"linha1\r\nlinha2"')
  })

  it('doubles inner quotes', () => {
    expect(escapeCsvField('ela disse "oi"')).toBe('"ela disse ""oi"""')
  })

  it('does not quote a comma when the delimiter is a semicolon', () => {
    expect(escapeCsvField('Silva, Ana')).toBe('Silva, Ana')
    expect(escapeCsvField('Silva, Ana', ',')).toBe('"Silva, Ana"')
  })
})

describe('formatCsvCell', () => {
  it('renders empty cells for null and undefined', () => {
    expect(formatCsvCell(null)).toBe('')
    expect(formatCsvCell(undefined)).toBe('')
  })

  it('keeps numbers numeric, including negatives, and drops non-finite ones', () => {
    expect(formatCsvCell(1200)).toBe('1200')
    expect(formatCsvCell(-3)).toBe('-3')
    expect(formatCsvCell(Number.NaN)).toBe('')
  })

  it('neutralizes the formula before quoting', () => {
    expect(formatCsvCell('=HYPERLINK("http://x";"y")')).toBe(`"'=HYPERLINK(""http://x"";""y"")"`)
  })
})

describe('buildCsv', () => {
  it('starts with the BOM and uses semicolon and CRLF', () => {
    const csv = buildCsv(['Nome', 'Pontos'], [['Ana', 10], ['Bia', 8]])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toBe(`${CSV_BOM}Nome;Pontos\r\nAna;10\r\nBia;8\r\n`)
  })

  it('preserves unicode text', () => {
    const csv = buildCsv(['Nome'], [['José Conceição 🏸 北京']], { bom: false })
    expect(csv).toBe('Nome\r\nJosé Conceição 🏸 北京\r\n')
  })

  it('keeps a multi-line name inside a single quoted cell', () => {
    const csv = buildCsv(['Nome', 'Clube'], [['Ana\nMaria', 'Clube "A"']], { bom: false })
    expect(csv).toBe('Nome;Clube\r\n"Ana\nMaria";"Clube ""A"""\r\n')
  })

  it('supports a custom delimiter and no BOM', () => {
    expect(buildCsv(['a', 'b'], [['x,y', 'z']], { delimiter: ',', bom: false })).toBe('a,b\r\n"x,y",z\r\n')
  })

  it('writes only the header for an empty list', () => {
    expect(buildCsv(['A', 'B'], [], { bom: false })).toBe('A;B\r\n')
  })
})

describe('slugifyFilename', () => {
  it('removes accents, punctuation and case', () => {
    expect(slugifyFilename('Copa São Paulo — Inscritos 2026!')).toBe('copa-sao-paulo-inscritos-2026')
  })

  it('falls back when nothing usable is left and limits the length', () => {
    expect(slugifyFilename('???')).toBe('exportacao')
    expect(slugifyFilename('a'.repeat(200)).length).toBeLessThanOrEqual(60)
  })
})

describe('csvAttachmentHeader', () => {
  it('builds an attachment header with an ASCII name and filename*', () => {
    expect(csvAttachmentHeader('Ranking Simples Masc. 2026')).toBe(
      `attachment; filename="ranking-simples-masc-2026.csv"; filename*=UTF-8''ranking-simples-masc-2026.csv`,
    )
  })

  it('never lets header injection characters through', () => {
    const header = csvAttachmentHeader('x"\r\nSet-Cookie: a=b')
    expect(header).not.toMatch(/[\r\n]/)
    expect(header.match(/"/g)).toHaveLength(2)
  })
})
