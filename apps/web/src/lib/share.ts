// Regras puras de compartilhamento: URL do site, limpeza e limite de texto, textos de
// compartilhamento e caminhos das imagens. Sem I/O, para ficarem testadas.

const DEFAULT_SITE_URL = 'http://localhost:3000'

/** Origem pública do site, sem barra final. Valor ausente, vazio ou inválido cai no padrão local. */
export function resolveSiteUrl(raw: string | undefined): string {
  const value = raw?.trim()
  if (!value) return DEFAULT_SITE_URL
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_SITE_URL
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return DEFAULT_SITE_URL
  }
}

/** `NEXT_PUBLIC_SITE_URL`, para links absolutos em metadados (og:image, twitter:image). */
export function getSiteUrl(): string {
  return resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
}

// Caracteres de controle (Cc) e de formatação (Cf: largura zero, direção bidi, BOM) ficam de fora de qualquer texto desenhado.
const CONTROL_CHARS = /\p{Cc}/gu
const FORMAT_CHARS = /\p{Cf}/gu

/** Remove invisíveis e quebras de linha, e colapsa espaços. */
export function cleanText(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(CONTROL_CHARS, ' ').replace(FORMAT_CHARS, '').replace(/\s+/g, ' ').trim()
}

/** Limpa e corta em `max` caracteres (pontos de código, sem partir emoji), terminando em reticências. */
export function truncateText(text: string | null | undefined, max: number): string {
  const clean = cleanText(text)
  const chars = Array.from(clean)
  if (chars.length <= max) return clean
  if (max <= 1) return '…'.slice(0, max)
  return `${chars.slice(0, max - 1).join('').trimEnd()}…`
}

/** Une os nomes de uma dupla (ou devolve só o do atleta de simples). */
export function joinNames(names: readonly (string | null | undefined)[], separator = ' / '): string {
  return names.map((n) => cleanText(n)).filter(Boolean).join(separator)
}

/** "Ranking WS 2025": acrescenta "Ranking" e o ano só quando o nome ainda não os traz. */
export function rankingDisplayName(name: string, year: number): string {
  const clean = cleanText(name)
  const withKind = /ranking/i.test(clean) ? clean : `Ranking ${clean}`
  return year > 0 && !withKind.includes(String(year)) ? `${withKind} ${year}` : withKind
}

export type ShareKind = 'tournament' | 'athlete' | 'ranking'

export interface ShareTextInput {
  kind: ShareKind
  /** Nome do torneio, do atleta ou do ranking. */
  name: string
  /** Campeão(ões) do torneio, quando encerrado. */
  champion?: string | null
}

/** Texto padrão que acompanha o link ao compartilhar (Web Share API ou cópia). */
export function buildShareText({ kind, name, champion }: ShareTextInput): string {
  const title = truncateText(name, 80)
  if (kind === 'tournament') {
    const winner = truncateText(champion, 60)
    return winner ? `${title}: resultados e chave no BirdieAtlas. Campeão: ${winner}.` : `${title}: chave e resultados no BirdieAtlas.`
  }
  if (kind === 'athlete') return `${title}: perfil, títulos e posição nos rankings no BirdieAtlas.`
  return `${title}: classificação atualizada no BirdieAtlas.`
}

export type ShareImageFormat = 'landscape' | 'portrait'

export const SHARE_IMAGE_SIZES: Record<ShareImageFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1350 },
}

/** `?format=portrait` seleciona a versão 1080x1350; qualquer outro valor é paisagem. */
export function parseShareFormat(value: string | null | undefined): ShareImageFormat {
  return value === 'portrait' ? 'portrait' : 'landscape'
}

/** Caminho (relativo ao site) da imagem de compartilhamento de uma rota pública. */
export function shareImagePath(pagePath: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString()
  return `${pagePath.replace(/\/+$/, '')}/share-image${query ? `?${query}` : ''}`
}

/** Nome do arquivo PNG baixado: minúsculas, sem acento, só `a-z0-9-`. */
export function shareImageFilename(name: string, suffix = ''): string {
  const slug = cleanText(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
  return `${slug || 'birdieatlas'}${suffix ? `-${suffix}` : ''}.png`
}
