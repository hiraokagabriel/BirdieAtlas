import type { ReactElement } from 'react'
import { ImageResponse } from 'next/og'
import { SHARE_IMAGE_SIZES, getSiteUrl, shareImageFilename, type ShareImageFormat } from '@/lib/share'
import type { ShareLoad } from '@/lib/share-data'
import { FallbackCard } from './cards'
import { loadBrandFonts } from './fonts'

interface RenderOptions<T> {
  load: ShareLoad<T>
  format: ShareImageFormat
  render: (card: T, host: string) => ReactElement
  /** Título da imagem de fallback (ex.: "Atleta não encontrado"). */
  notFoundHeadline: string
  /** `?download=1`: devolve com `Content-Disposition: attachment` e este nome de arquivo. */
  download?: { name: string; suffix?: string } | null
}

const CACHE_OK = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
const CACHE_MISSING = 'public, max-age=60'

async function toPng(element: ReactElement, format: ShareImageFormat, useBrandFonts: boolean): Promise<ArrayBuffer> {
  const fonts = useBrandFonts ? await loadBrandFonts() : []
  // O corpo é lido aqui para qualquer falha do Satori virar exceção tratável, e não um 500 no meio do stream.
  return new ImageResponse(element, { ...SHARE_IMAGE_SIZES[format], ...(fonts.length > 0 ? { fonts } : {}) }).arrayBuffer()
}

/**
 * Gera o PNG de compartilhamento. Nunca devolve 500:
 * - erro de renderização com a fonte da marca: tenta de novo com a fonte padrão;
 * - ainda falhou: imagem de fallback;
 * - dado inexistente: fallback com 404; API fora do ar: fallback com 200 e sem cache.
 */
export async function renderShareImage<T>({ load, format, render, notFoundHeadline, download }: RenderOptions<T>): Promise<Response> {
  const host = new URL(getSiteUrl()).host
  const fallback = <FallbackCard headline={load.status === 'not_found' ? notFoundHeadline : 'Badminton em um só lugar'} format={format} host={host} />

  let element = load.status === 'ok' ? render(load.card, host) : fallback
  let png: ArrayBuffer | null = null
  for (const attempt of [{ el: element, fonts: true }, { el: element, fonts: false }, { el: fallback, fonts: false }]) {
    try {
      png = await toPng(attempt.el, format, attempt.fonts)
      element = attempt.el
      break
    } catch (err) {
      console.error('[share] falha ao renderizar a imagem de compartilhamento:', err)
      png = null
    }
  }

  const degraded = element === fallback
  const status = load.status === 'not_found' ? 404 : 200
  const headers: Record<string, string> = {
    'Content-Type': 'image/png',
    'Cache-Control': load.status === 'ok' && !degraded ? CACHE_OK : load.status === 'not_found' ? CACHE_MISSING : 'no-store',
  }
  if (download && status === 200) {
    headers['Content-Disposition'] = `attachment; filename="${shareImageFilename(download.name, download.suffix)}"`
  }
  if (!png) return new Response('Não foi possível gerar a imagem.', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return new Response(png, { status, headers })
}
