/** Minúsculas e sem acentos, para busca tolerante ("jose" encontra "José"). */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Todos os termos da consulta precisam aparecer no texto, em qualquer ordem. */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = normalizeText(text)
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  return terms.length > 0 && terms.every((term) => haystack.includes(term))
}
