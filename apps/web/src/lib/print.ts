// Impressão / PDF: regras puras do ajuste da chave à página A4 paisagem.
// O CSS de impressão está em `app/print.css`; o ajuste de escala acontece em `PrintButton`.

const MM_TO_PX = 96 / 25.4

/** A4 paisagem (297 x 210 mm) com margem de 10 mm: área útil em pixels CSS. */
export const A4_LANDSCAPE_USABLE = {
  width: Math.floor((297 - 20) * MM_TO_PX),
  height: Math.floor((210 - 20) * MM_TO_PX),
}

/** Altura reservada, na primeira página, ao título do torneio, ao campeão e ao nome da categoria. */
export const BRACKET_PRINT_RESERVED_HEIGHT = 190

/** Abaixo disto a chave fica ilegível no papel: prefere-se quebrar em mais páginas. */
export const MIN_READABLE_SCALE = 0.4

export interface PrintScaleInput {
  contentWidth: number
  contentHeight: number
  availableWidth: number
  availableHeight: number
  minScale?: number
}

/**
 * Escala (0 a 1) que encaixa a chave na página. A largura sempre cabe (cortar uma rodada seria pior);
 * a altura só é respeitada até `minScale`: chaves muito altas (a partir de uns 32 inscritos) continuam
 * legíveis e seguem para a página seguinte em vez de encolher até sumir.
 */
export function computePrintScale({
  contentWidth,
  contentHeight,
  availableWidth,
  availableHeight,
  minScale = MIN_READABLE_SCALE,
}: PrintScaleInput): number {
  if (contentWidth <= 0 || contentHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) return 1
  const byWidth = availableWidth / contentWidth
  const byHeight = availableHeight / contentHeight
  const fitsBoth = Math.min(1, byWidth, byHeight)
  const widthFloor = Math.min(minScale, byWidth)
  return Math.round(Math.max(fitsBoth, widthFloor) * 1000) / 1000
}
