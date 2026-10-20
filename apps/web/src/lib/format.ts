/** Datas da API vêm como `YYYY-MM-DD`: formata em UTC para não deslocar o dia. */
export function formatDate(value: string, style: 'short' | 'medium' = 'short'): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    ...(style === 'medium' ? { day: '2-digit', month: 'short', year: 'numeric' } : {}),
  }).format(date)
}

export function formatDateRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
}

export function formatPoints(value: number): string {
  return value.toLocaleString('pt-BR')
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

/** Nome do país em português a partir do código ISO; devolve o próprio código se não reconhecer. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
