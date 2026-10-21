// Fonte da marca (Barlow Condensed) para as imagens de compartilhamento.
//
// O ImageResponse só aceita ttf/otf/woff, e o `next/font/google` entrega woff2 (não serve aqui).
// Sem dependência nova e sem binário no repositório, o ttf é baixado do Google Fonts na primeira
// imagem e guardado em memória. Se o download falhar (servidor sem internet, timeout, CSS fora do
// formato esperado), a imagem sai com a fonte padrão do ImageResponse: a rota nunca devolve 500
// por causa da fonte. Depois de uma falha, nova tentativa só passa de FAILURE_RETRY_MS.

export interface ImageFont {
  name: string
  data: ArrayBuffer
  weight: 500 | 700
  style: 'normal'
}

const FAMILY = 'Barlow Condensed'
const WEIGHTS = [500, 700] as const
const CSS_URL = `https://fonts.googleapis.com/css2?family=${FAMILY.replace(' ', '+')}:wght@${WEIGHTS.join(';')}`
const FETCH_TIMEOUT_MS = 4000
const FAILURE_RETRY_MS = 5 * 60 * 1000

/** Extrai `peso -> URL do ttf` do CSS do Google Fonts (sem User-Agent de navegador, ele devolve ttf). */
export function parseFontFaces(css: string): Map<number, string> {
  const urls = new Map<number, string>()
  for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1]
    const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(block)?.[1]
    if (weight && url) urls.set(Number(weight), url)
  }
  return urls
}

async function download(): Promise<ImageFont[]> {
  const css = await (await fetch(CSS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text()
  const urls = parseFontFaces(css)
  return Promise.all(
    WEIGHTS.map(async (weight) => {
      const url = urls.get(weight)
      if (!url) throw new Error(`Peso ${weight} ausente no CSS da fonte.`)
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!res.ok) throw new Error(`Fonte ${weight}: HTTP ${res.status}`)
      return { name: FAMILY, data: await res.arrayBuffer(), weight, style: 'normal' as const }
    }),
  )
}

let cached: ImageFont[] | null = null
let pending: Promise<ImageFont[]> | null = null
let failedAt = 0

/** Fontes da marca, ou lista vazia (fonte padrão do ImageResponse) se não foi possível obtê-las. */
export async function loadBrandFonts(): Promise<ImageFont[]> {
  if (cached) return cached
  if (Date.now() - failedAt < FAILURE_RETRY_MS) return []
  pending ??= download()
    .then((fonts) => {
      cached = fonts
      return fonts
    })
    .catch((err: unknown) => {
      console.error('[share] fonte da marca indisponível, usando a fonte padrão:', err)
      failedAt = Date.now()
      return []
    })
    .finally(() => {
      pending = null
    })
  return pending
}
