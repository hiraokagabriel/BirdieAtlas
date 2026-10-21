// Construtor de CSV puro para as exportações. Convenção do Excel em português do Brasil:
// separador `;`, quebra de linha CRLF e BOM UTF-8 no início (sem o BOM o Excel lê acentos errado).

export type CsvCell = string | number | null | undefined

export const CSV_DELIMITER = ';'
export const CSV_BOM = '﻿'

/** Células de texto que começam com estes caracteres viram fórmula no Excel/Sheets. */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r'])

/**
 * Neutraliza injeção de fórmula: texto que começa com `=`, `+`, `-`, `@`, TAB ou CR ganha um apóstrofo
 * na frente. Números (tipo `number`) não passam por aqui, então valores negativos continuam numéricos.
 */
export function neutralizeFormula(text: string): string {
  const first = text.charAt(0)
  return first !== '' && FORMULA_PREFIXES.has(first) ? `'${text}` : text
}

/** Aspas duplas dobradas e o campo entre aspas quando tem separador, aspas ou quebra de linha. */
export function escapeCsvField(text: string, delimiter: string = CSV_DELIMITER): string {
  const needsQuotes = text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r')
  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text
}

export function formatCsvCell(cell: CsvCell, delimiter: string = CSV_DELIMITER): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : ''
  return escapeCsvField(neutralizeFormula(cell), delimiter)
}

export interface CsvOptions {
  delimiter?: string
  /** `false` só para testes ou consumidores que não são o Excel. */
  bom?: boolean
}

/** Monta o arquivo: BOM, cabeçalho e linhas separados por CRLF, com CRLF no final. */
export function buildCsv(
  header: readonly string[],
  rows: readonly (readonly CsvCell[])[],
  options: CsvOptions = {},
): string {
  const delimiter = options.delimiter ?? CSV_DELIMITER
  const lines = [header, ...rows].map((row) => row.map((cell) => formatCsvCell(cell, delimiter)).join(delimiter))
  return `${options.bom === false ? '' : CSV_BOM}${lines.join('\r\n')}\r\n`
}

/** Nome de arquivo seguro: minúsculas, sem acento, só `a-z0-9-`, no máximo 60 caracteres. */
export function slugifyFilename(text: string, fallback = 'exportacao'): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || fallback
}

/** `Content-Disposition` de download. O nome já vem slugado (ASCII); `filename*` segue a RFC 5987. */
export function csvAttachmentHeader(baseName: string): string {
  const filename = `${slugifyFilename(baseName)}.csv`
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
