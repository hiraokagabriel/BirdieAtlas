'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { qrBaseUrl } from '@/lib/share'

/**
 * QR code para o público abrir a página do torneio no celular. O endereço vem de `NEXT_PUBLIC_SITE_URL` ou da
 * origem do telão; aberto por localhost, mostra só a dica de abrir pelo IP da rede.
 */
export function TvQrCode({ path }: { path: string }) {
  const [state, setState] = useState<{ url: string; svg: string } | 'local' | null>(null)

  useEffect(() => {
    const base = qrBaseUrl(process.env.NEXT_PUBLIC_SITE_URL, window.location)
    if (!base) {
      setState('local')
      return
    }
    const url = `${base}${path}`
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => setState({ url, svg }))
      .catch(() => setState(null))
  }, [path])

  if (state === null) return null
  if (state === 'local') {
    return <p className="max-w-48 text-xs text-muted-foreground">Abra o telão pelo IP da rede para mostrar o QR code do público.</p>
  }
  return (
    <figure className="flex items-center gap-3">
      {/* SVG gerado pela biblioteca a partir do endereço do próprio site; o texto ao lado diz o mesmo endereço.
          bg-white fixo de propósito: o leitor de QR precisa de fundo claro nos dois temas. */}
      <span aria-hidden="true" className="block size-24 rounded-md bg-white p-1 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: state.svg }} />
      <figcaption className="max-w-40 text-sm">
        <span className="font-semibold">Acompanhe no celular</span>
        <span className="block break-all text-xs text-muted-foreground">{state.url}</span>
      </figcaption>
    </figure>
  )
}
