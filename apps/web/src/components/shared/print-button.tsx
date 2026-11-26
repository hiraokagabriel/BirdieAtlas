'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { A4_LANDSCAPE_USABLE, BRACKET_PRINT_RESERVED_HEIGHT, computePrintScale } from '@/lib/print'

/** Elementos com este atributo são reduzidos para caber numa página A4 paisagem ao imprimir. */
const FIT_SELECTOR = '[data-print-fit]'

/**
 * Ajusta cada elemento `data-print-fit` à página. Só o de fora conta: um `data-print-fit` dentro de outro (a árvore
 * dentro de uma categoria inteira, em /t/[slug]/chaves) fica sem zoom próprio, para a escala não se multiplicar.
 * `data-print-reserved` (px) é a altura que o cabeçalho da página ocupa; `data-print-max-scale` permite ampliar.
 */
function fitElements(): void {
  // Mede com o layout de papel (chave desenrolada, sem rolagem): o `beforeprint` ainda roda no layout de tela.
  document.documentElement.classList.add('print-measuring')
  document.querySelectorAll<HTMLElement>(FIT_SELECTOR).forEach((element) => {
    element.style.zoom = ''
    if (element.parentElement?.closest(FIT_SELECTOR)) return
    const { width, height } = element.getBoundingClientRect()
    const reserved = Number(element.dataset.printReserved ?? BRACKET_PRINT_RESERVED_HEIGHT)
    const scale = computePrintScale({
      contentWidth: width,
      contentHeight: height,
      availableWidth: A4_LANDSCAPE_USABLE.width,
      availableHeight: A4_LANDSCAPE_USABLE.height - reserved,
      maxScale: Number(element.dataset.printMaxScale ?? 1),
      ...(element.dataset.printMinScale ? { minScale: Number(element.dataset.printMinScale) } : {}),
    })
    if (scale !== 1) element.style.zoom = String(scale)
  })
}

function resetElements(): void {
  document.documentElement.classList.remove('print-measuring')
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
