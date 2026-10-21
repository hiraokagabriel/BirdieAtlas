import type { Metadata } from 'next'

export interface ShareMetadataInput {
  title: string
  description: string
  /** Caminho da página (ex.: `/t/copa-sp`), relativo ao `metadataBase` do layout raiz. */
  path: string
  /** Caminho da imagem de compartilhamento (relativo; o Next o torna absoluto com `metadataBase`). */
  imagePath: string
  imageAlt: string
}

/** Open Graph e Twitter Card com a imagem gerada pela própria plataforma (1200x630). */
export function shareMetadata({ title, description, path, imagePath, imageAlt }: ShareMetadataInput): Metadata {
  const images = [{ url: imagePath, width: 1200, height: 630, alt: imageAlt, type: 'image/png' }]
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', locale: 'pt_BR', siteName: 'BirdieAtlas', title, description, url: path, images },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: imagePath, alt: imageAlt }] },
  }
}
