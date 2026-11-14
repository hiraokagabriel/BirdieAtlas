import { z } from 'zod'

export const MIN_BIRTH_YEAR = 1900

/** Ano de nascimento (o único dado de nascimento guardado): inteiro de 1900 até o ano corrente. */
export function birthYearSchema(now: Date = new Date()) {
  return z.coerce
    .number({ invalid_type_error: 'Ano de nascimento deve ser um número' })
    .int('Ano de nascimento deve ser um número inteiro')
    .min(MIN_BIRTH_YEAR, `Ano de nascimento deve estar entre ${MIN_BIRTH_YEAR} e ${now.getFullYear()}`)
    .max(now.getFullYear(), `Ano de nascimento deve estar entre ${MIN_BIRTH_YEAR} e ${now.getFullYear()}`)
}

/** Igual a `birthYearSchema`, mas vazio (ou ausente) vira null: campo opcional de formulário e de CSV. */
export function optionalBirthYearSchema(now: Date = new Date()) {
  return z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), birthYearSchema(now).nullable())
}
