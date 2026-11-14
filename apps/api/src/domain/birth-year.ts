import { z } from 'zod'

export const MIN_BIRTH_YEAR = 1900

/**
 * Ano de nascimento (o único dado de nascimento guardado): inteiro de 1900 até o ano corrente.
 * O teto é calculado na hora do parse, para um processo que atravessa a virada do ano aceitar o ano novo.
 */
export function birthYearSchema(now: () => Date = () => new Date()) {
  return z.coerce
    .number({ invalid_type_error: 'Ano de nascimento deve ser um número' })
    .int('Ano de nascimento deve ser um número inteiro')
    .superRefine((year, ctx) => {
      const max = now().getFullYear()
      if (year < MIN_BIRTH_YEAR || year > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ano de nascimento deve estar entre ${MIN_BIRTH_YEAR} e ${max}` })
      }
    })
}

/** Igual a `birthYearSchema`, mas vazio (ou ausente) vira null: campo opcional de formulário e de CSV. */
export function optionalBirthYearSchema(now?: () => Date) {
  return z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), birthYearSchema(now).nullable())
}
