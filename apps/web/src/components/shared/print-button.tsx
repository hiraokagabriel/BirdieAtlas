'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { A4_LANDSCAPE_USABLE, BRACKET_PRINT_RESERVED_HEIGHT, computePrintScale } from '@/lib/print'

/** Elementos com este atributo são reduzidos para caber numa página A4 paisagem ao imprimir. */
const FIT_SELECTOR = '[data-print-fit]'

function fitElements(): void {
  document.querySelectorAll<HTMLElement>(FIT_SELECTOR).forEach((element) => {
    element.style.zoom = ''
    const { width, height } = element.getBoundingClientRect()
    const scale = computePrintScale({
      contentWidth: width,
      contentHeight: height,
      availableWidth: A4_LANDSCAPE_USABLE.width,
      availableHeight: A4_LANDSCAPE_USABLE.height - BRACKET_PRINT_RESERVED_HEIGHT,
    })
    if (scale < 1) element.style.zoom = String(scale)
  })
}

function resetElements(): void {
  document.querySelectorAll<HTMLElement>(FIT_SELECTOR).forEach((element) => {
    element.style.zoom = ''
  })
}

/**
 * Botão "Imprimir / Salvar PDF". Os ajustes valem para qualquer impressão da página (inclusive Ctrl+P),
 * porque ficam em `beforeprint`/`afterprint`: tema claro forçado e chave reduzida à página. Tudo é
 * desfeito em `afterprint`.
 */
export function PrintButton({ className }: { className?: string }) {
  useEffect(() => {
    const root = document.documentElement
    let wasDark = false

    const onBeforePrint = () => {
      wasDark = root.classList.contains('dark')
      if (wasDark) root.classList.remove('dark')
      fitElements()
    }
    const onAfterPrint = () => {
      if (wasDark) root.classList.add('dark')
      wasDark = false
      resetElements()
    }

    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [])

  return (
    <Button type="button" variant="outline" size="lg" className={className} onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      Imprimir / Salvar PDF
    </Button>
  )
}
