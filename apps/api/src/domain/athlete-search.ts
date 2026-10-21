import { z } from 'zod'

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 80
export const SEARCH_MAX_TERMS = 5

/** Letras acentuadas do português e seus equivalentes sem acento, na mesma ordem (para `translate` do Postgres). */
export const ACCENTED_CHARS = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'
export const PLAIN_CHARS = 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'

/** Minúsculas e sem acentos: "JOSÉ" vira "jose". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Escapa `\`, `%` e `_` para o termo valer como texto literal num LIKE (a barra invertida é o escape padrão do Postgres). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => '\\' + c)
}

/** Termos já normalizados e escapados; todos precisam aparecer no nome, em qualquer ordem. */
export function toSearchPatterns(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, SEARCH_MAX_TERMS)
    .map((term) => `%${escapeLike(term)}%`)
}

export const athleteSearchQuerySchema = z.object({
  q: z.string().trim().min(SEARCH_MIN_LENGTH).max(SEARCH_MAX_LENGTH),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(25).default(10),
})

export type AthleteSearchQuery = z.infer<typeof athleteSearchQuerySchema>
