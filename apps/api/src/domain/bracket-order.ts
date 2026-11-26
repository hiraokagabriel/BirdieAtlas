// Ordem de divulgação das categorias (todas as chaves do torneio): disciplina na ordem SM, SF, DM, DF, DX e,
// dentro dela, o nome com números em ordem natural ("Sub 9" antes de "Sub 11").
import { disciplineEnum } from '../db/schema.js'

const DISCIPLINE_ORDER: readonly string[] = disciplineEnum.enumValues

export function compareCategoriesForPublication(a: { discipline: string; name: string }, b: { discipline: string; name: string }): number {
  return DISCIPLINE_ORDER.indexOf(a.discipline) - DISCIPLINE_ORDER.indexOf(b.discipline)
    || a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
}
