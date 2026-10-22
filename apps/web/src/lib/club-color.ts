/**
 * Cor de marca do clube usada como texto/ícone. A cor vem do cadastro (qualquer uma), então o contraste não
 * pode depender dela: a cor é misturada (oklab, como o `color-mix` do CSS) em direção ao texto padrão até
 * chegar a 4,5:1 contra o fundo mais claro do tema claro. No tema escuro, `--club-ink-mix` (globals.css)
 * clareia a cor em direção ao texto padrão; vale o maior dos dois percentuais.
 */

type Oklab = { L: number; a: number; b: number }

// Texto padrão do tema claro (`--foreground`, oklch(0.22 0.03 160)) e fundos mais claros do app.
const FOREGROUND_LIGHT_THEME: Oklab = oklchToOklab(0.22, 0.03, 160)
// Fundo mais claro em que o texto de marca aparece no tema claro: `--background` (oklch(0.985 0.006 95)).
const BACKGROUND_LUMINANCE_LIGHT_THEME = luminanceOf(oklchToOklab(0.985, 0.006, 95))

function oklchToOklab(L: number, C: number, h: number): Oklab {
  const rad = (h * Math.PI) / 180
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) }
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function hexToOklab(hex: string): Oklab | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match?.[1]) return null
  const n = parseInt(match[1], 16)
  const r = srgbToLinear(((n >> 16) & 255) / 255)
  const g = srgbToLinear(((n >> 8) & 255) / 255)
  const b = srgbToLinear((n & 255) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/** Luminância relativa WCAG de uma cor em oklab (canais lineares limitados ao gamut sRGB). */
function luminanceOf({ L, a, b }: Oklab): number {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const r = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const g = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const bl = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

function contrast(luminanceA: number, luminanceB: number): number {
  const [hi, lo] = luminanceA > luminanceB ? [luminanceA, luminanceB] : [luminanceB, luminanceA]
  return (hi + 0.05) / (lo + 0.05)
}

function mixOklab(from: Oklab, to: Oklab, percent: number): Oklab {
  const t = percent / 100
  return { L: from.L + (to.L - from.L) * t, a: from.a + (to.a - from.a) * t, b: from.b + (to.b - from.b) * t }
}

/**
 * Menor percentual (de 5 em 5) de mistura em direção ao texto escuro que dá 4,5:1 contra o fundo claro.
 * Cor que o app não consegue ler (formato desconhecido) recebe a mistura máxima de segurança.
 */
export function clubInkMixForLightTheme(color: string): number {
  const base = hexToOklab(color)
  if (!base) return 60
  for (let percent = 0; percent <= 100; percent += 5) {
    const mixed = mixOklab(base, FOREGROUND_LIGHT_THEME, percent)
    if (contrast(luminanceOf(mixed), BACKGROUND_LUMINANCE_LIGHT_THEME) >= 4.5) return percent
  }
  return 100
}

export function clubInkColor(color: string): string {
  return `color-mix(in oklab, ${color}, var(--foreground) max(var(--club-ink-mix), ${clubInkMixForLightTheme(color)}%))`
}

/** Para texto sobre superfície sempre branca (independe do tema): mistura com o texto escuro do tema claro. */
export function clubInkOnWhite(color: string): string {
  return `color-mix(in oklab, ${color}, oklch(0.22 0.03 160) ${clubInkMixForLightTheme(color)}%)`
}

/** Contraste (texto escuro do tema claro sobre o fundo claro) da cor resultante; usado nos testes. */
export function clubInkContrastOnLightTheme(color: string): number {
  const base = hexToOklab(color)
  if (!base) return 0
  const mixed = mixOklab(base, FOREGROUND_LIGHT_THEME, clubInkMixForLightTheme(color))
  return contrast(luminanceOf(mixed), BACKGROUND_LUMINANCE_LIGHT_THEME)
}
