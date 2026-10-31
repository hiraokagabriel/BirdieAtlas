import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/share-image/brand'

// Ícones do app instalável: "BA" amarelo sobre o verde da marca. `maskable` ocupa a área toda
// (o sistema recorta), com o texto dentro da zona segura de 80%.
const SIZES: Record<string, { px: number; maskable: boolean }> = {
  '192': { px: 192, maskable: false },
  '512': { px: 512, maskable: false },
  '180': { px: 180, maskable: false },
  maskable: { px: 512, maskable: true },
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  const spec = SIZES[kind]
  if (!spec) return new Response('Not found', { status: 404 })

  const { px, maskable } = spec
  const radius = maskable ? 0 : Math.round(px * 0.22)
  const fontSize = Math.round(px * (maskable ? 0.36 : 0.46))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenDeep})`,
          borderRadius: radius,
          color: BRAND.yellow,
          fontSize,
          fontWeight: 800,
          letterSpacing: -2,
        }}
      >
        BA
      </div>
    ),
    { width: px, height: px, headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
