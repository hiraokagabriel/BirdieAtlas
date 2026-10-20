export const DISCIPLINE_LABELS: Record<string, string> = {
  MS: 'Simples masculino',
  WS: 'Simples feminino',
  MD: 'Duplas masculinas',
  WD: 'Duplas femininas',
  XD: 'Duplas mistas',
}

const DOUBLES = new Set(['MD', 'WD', 'XD'])

export function disciplineLabel(discipline: string): string {
  return DISCIPLINE_LABELS[discipline] ?? discipline
}

export function isDoublesDiscipline(discipline: string): boolean {
  return DOUBLES.has(discipline)
}
