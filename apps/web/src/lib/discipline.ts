// Cores de modalidade (MS/WS/MD/WD/XD) vêm dos tokens `--discipline-*` de
// globals.css, que têm variantes clara e escura. As classes aparecem completas
// aqui para o Tailwind encontrá-las.

/** Pílula suave: fundo tingido, texto e borda (a borda só aparece com a classe `border`). */
export const DISCIPLINE_PILL: Record<string, string> = {
  MS: 'bg-discipline-ms text-discipline-ms-foreground border-discipline-ms-border',
  WS: 'bg-discipline-ws text-discipline-ws-foreground border-discipline-ws-border',
  MD: 'bg-discipline-md text-discipline-md-foreground border-discipline-md-border',
  WD: 'bg-discipline-wd text-discipline-wd-foreground border-discipline-wd-border',
  XD: 'bg-discipline-xd text-discipline-xd-foreground border-discipline-xd-border',
}

/** Pílula preenchida, para o estado selecionado. */
export const DISCIPLINE_PILL_ACTIVE: Record<string, string> = {
  MS: 'bg-discipline-ms-solid text-discipline-ms-solid-foreground border-discipline-ms-solid',
  WS: 'bg-discipline-ws-solid text-discipline-ws-solid-foreground border-discipline-ws-solid',
  MD: 'bg-discipline-md-solid text-discipline-md-solid-foreground border-discipline-md-solid',
  WD: 'bg-discipline-wd-solid text-discipline-wd-solid-foreground border-discipline-wd-solid',
  XD: 'bg-discipline-xd-solid text-discipline-xd-solid-foreground border-discipline-xd-solid',
}

const CHART_KEYS = ['ms', 'ws', 'md', 'wd', 'xd']

/** Cor sólida para gráficos (usar em `style`, não como atributo SVG). */
export function disciplineChartColor(discipline: string): string {
  const key = discipline.toLowerCase()
  return `var(--discipline-${CHART_KEYS.includes(key) ? key : 'ms'}-solid)`
}

/** Gênero do atleta (M/F) reaproveita as pílulas de simples masculino e feminino. */
export const GENDER_PILL: Record<'M' | 'F', string> = {
  M: DISCIPLINE_PILL.MS,
  F: DISCIPLINE_PILL.WD,
}

/** Avatar de iniciais por gênero: mesmas cores sólidas das modalidades, com contraste AA. */
export function genderAvatarClass(gender: string): string {
  return gender === 'M' ? DISCIPLINE_PILL_ACTIVE.MS : DISCIPLINE_PILL_ACTIVE.WD
}
