/**
 * Cor de marca do clube usada como texto/ícone. No tema escuro, `--club-ink-mix`
 * (globals.css) clareia a cor em direção ao texto padrão para manter o contraste;
 * no claro vale 0% e a cor fica como cadastrada.
 */
export function clubInkColor(color: string): string {
  return `color-mix(in oklab, ${color}, var(--foreground) var(--club-ink-mix))`
}
