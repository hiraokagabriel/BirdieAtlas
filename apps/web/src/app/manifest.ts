import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/share-image/brand'

// Manifesto do app instalável. Instalar exige HTTPS (ou localhost); na rede local por IP, só pelo
// endereço https ou por localhost. Os ícones são gerados em /pwa-icon/[kind].
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BirdieAtlas',
    short_name: 'BirdieAtlas',
    description: 'Torneios, chaves, placar ao vivo e rankings de badminton.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BRAND.paper,
    theme_color: BRAND.green,
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
