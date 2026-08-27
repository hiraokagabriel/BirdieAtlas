export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}
