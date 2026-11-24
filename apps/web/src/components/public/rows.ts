/** Lista com divisórias, o contêiner padrão de coleções (docs/DESIGN.md, Cards / Containers). */
export const ROWS = 'divide-y divide-border overflow-hidden rounded-lg border border-border bg-card'
/** Linha clicável dentro de `ROWS`: o contorno de foco fica dentro da borda arredondada. */
export const ROW_LINK = 'transition-colors hover:bg-muted/60 focus-visible:outline-offset-[-2px]'
/** Link dentro de texto corrido (o foco usa o contorno global de globals.css). */
export const INLINE_LINK = 'rounded-sm hover:underline'
