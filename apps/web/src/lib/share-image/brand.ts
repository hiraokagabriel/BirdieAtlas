// Cores da marca em hexadecimal. O Satori (ImageResponse) não lê `oklch`, então estes valores são a
// conversão dos tokens de `globals.css` (tema claro): primary, accent, background, foreground, medalhas.
export const BRAND = {
  green: '#0b703f',
  greenDeep: '#00391b',
  greenSoft: '#cfe8d6',
  yellow: '#f9e58e',
  yellowInk: '#3b3200',
  paper: '#fbfaf6',
  paperMuted: '#f2f0e9',
  ink: '#0d1f16',
  inkMuted: '#535e55',
  line: '#e0ded5',
  gold: '#eec743',
  goldInk: '#3c2b02',
  silver: '#c9ced4',
  silverInk: '#25282c',
  bronze: '#d78951',
  bronzeInk: '#3a1c05',
} as const

export const MEDALS: Record<number, { bg: string; ink: string }> = {
  1: { bg: BRAND.gold, ink: BRAND.goldInk },
  2: { bg: BRAND.silver, ink: BRAND.silverInk },
  3: { bg: BRAND.bronze, ink: BRAND.bronzeInk },
}

export const FONT_FAMILY = 'Barlow Condensed'
