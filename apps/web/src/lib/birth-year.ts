/** Idade esportiva pelo ano de nascimento (o único dado de nascimento guardado): ano corrente menos o ano. */
export function ageFromBirthYear(birthYear: number | null, now: Date = new Date()): string {
  return birthYear == null ? '—' : `${now.getFullYear() - birthYear} anos`
}

export const MIN_BIRTH_YEAR = 1900

/** Mensagem de erro do campo de ano (vazio é válido: o campo é opcional), ou null. */
export function birthYearError(value: string, now: Date = new Date()): string | null {
  const text = value.trim()
  if (!text) return null
  const year = Number(text)
  return /^\d{4}$/.test(text) && year >= MIN_BIRTH_YEAR && year <= now.getFullYear()
    ? null
    : `Ano de nascimento deve estar entre ${MIN_BIRTH_YEAR} e ${now.getFullYear()}`
}
