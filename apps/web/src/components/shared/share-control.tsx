'use client'

import { useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { SHARE_MESSAGES, shareOrCopy, shareUrlFrom, type ShareOutcome } from '@/lib/share-client'

export interface ShareImageLink {
  label: string
  href: string
  filename: string
}

interface ShareControlProps {
  title: string
  text: string
  /** Imagens para baixar: a primeira é o cartão principal (1200x630). */
  images: readonly ShareImageLink[]
  className?: string
}

/**
 * "Compartilhar" (Web Share API quando existe, cópia do link como alternativa) e "Baixar imagem".
 * A confirmação aparece como toast e também numa região `aria-live`, lida por leitores de tela.
 */
export function ShareControl({ title, text, images, className }: ShareControlProps) {
  const { toast } = useToast()
  const [message, setMessage] = useState('')

  async function handleShare() {
    const outcome: ShareOutcome = await shareOrCopy(navigator, { title, text, url: shareUrlFrom(window.location.href) })
    const next = SHARE_MESSAGES[outcome]
    setMessage(next)
    if (outcome === 'copied' || outcome === 'failed') {
      toast({
        title: outcome === 'copied' ? 'Link copiado' : 'Não foi possível copiar',
        description: next,
        variant: outcome === 'failed' ? 'destructive' : 'default',
      })
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="lg" onClick={handleShare}>
          <Share2 aria-hidden="true" />
          Compartilhar
        </Button>
        {images.map((image) => (
          <Button key={image.href} asChild variant="outline" size="lg">
            <a href={image.href} download={image.filename}>
              <Download aria-hidden="true" />
              {image.label}
            </a>
          </Button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
