import { expect, type Locator, type Page } from '@playwright/test'

// Verificações que o axe não faz (ou não faz de forma confiável). Cada função roda no navegador e devolve
// dados simples; as asserções e as mensagens ficam nos specs.

/** Controles de formulário visíveis sem rótulo de verdade (label, aria-label ou aria-labelledby). Placeholder e title não contam. */
export async function unlabeledFields(page: Page, scope = 'body'): Promise<string[]> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector)
    if (!root) return ['(escopo não encontrado)']
    const fields = Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea'))
    const result: string[] = []
    for (const el of fields) {
      if (el instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset', 'image'].includes(el.type)) continue
      if (el.closest('[hidden], [aria-hidden="true"]')) continue
      const style = getComputedStyle(el)
      // Rádios e arquivos escondidos visualmente (sr-only) continuam valendo: eles são o controle de verdade.
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const labelled =
        ((el as HTMLInputElement).labels?.length ?? 0) > 0 ||
        Boolean(el.getAttribute('aria-label')?.trim()) ||
        Boolean(el.getAttribute('aria-labelledby')?.trim())
      if (!labelled) result.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}[${el.getAttribute('placeholder') ?? el.getAttribute('type') ?? ''}]`)
    }
    return result
  }, scope)
}

/** Níveis de cabeçalho na ordem do DOM (só os visíveis para tecnologia assistiva). */
export async function headingLevels(page: Page): Promise<{ level: number; text: string }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
      .filter((h) => !h.closest('[hidden], [aria-hidden="true"]') && getComputedStyle(h).display !== 'none')
      .map((h) => ({ level: Number(h.tagName.slice(1)), text: (h.textContent ?? '').trim().slice(0, 60) })),
  )
}

/** Procura saltos de nível (h1 direto para h3) e devolve descrições legíveis. */
export function headingProblems(headings: readonly { level: number; text: string }[]): string[] {
  const problems: string[] = []
  const h1s = headings.filter((h) => h.level === 1).length
  if (h1s !== 1) problems.push(`esperava um h1, achou ${h1s}`)
  let previous = 0
  for (const heading of headings) {
    if (previous !== 0 && heading.level > previous + 1) {
      problems.push(`h${previous} seguido de h${heading.level} ("${heading.text}")`)
    }
    previous = heading.level
  }
  return problems
}

export interface FocusIndicator {
  tag: string
  name: string
  kind: 'outline' | 'ring' | 'nenhum'
  widthPx: number
  contrast: number
}

/**
 * Lê o indicador de foco do elemento focado: contorno (`outline`) ou anel (`box-shadow`) e o contraste da cor
 * dele contra o fundo opaco mais próximo. Converte qualquer cor CSS (inclusive oklch) por um canvas.
 */
export async function focusIndicator(page: Page): Promise<FocusIndicator> {
  return page.evaluate(() => {
    const focused = document.activeElement as HTMLElement | null
    if (!focused || focused === document.body) return { tag: 'BODY', name: '', kind: 'nenhum' as const, widthPx: 0, contrast: 0 }
    // Rádio/checkbox/arquivo escondido (sr-only): quem mostra o foco é o rótulo que o envolve.
    const hiddenControl =
      focused instanceof HTMLInputElement && ['radio', 'checkbox', 'file'].includes(focused.type) && focused.getBoundingClientRect().width <= 2
    const el = (hiddenControl ? focused.closest('label') : null) ?? focused

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const toRgba = (css: string): [number, number, number, number] => {
      if (!ctx) return [0, 0, 0, 0]
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255]
    }
    const lum = ([r, g, b]: [number, number, number, number]) => {
      const lin = (v: number) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
    const over = (fg: [number, number, number, number], bg: [number, number, number, number]): [number, number, number, number] => [
      fg[0] * fg[3] + bg[0] * (1 - fg[3]),
      fg[1] * fg[3] + bg[1] * (1 - fg[3]),
      fg[2] * fg[3] + bg[2] * (1 - fg[3]),
      1,
    ]
    // Fundo: primeiro ancestral com cor opaca; camadas translúcidas são compostas sobre o que vem abaixo.
    const layers: [number, number, number, number][] = []
    for (let node: HTMLElement | null = el.parentElement; node; node = node.parentElement) {
      const c = toRgba(getComputedStyle(node).backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] >= 1) break
    }
    let background: [number, number, number, number] = [255, 255, 255, 1]
    for (const layer of layers.reverse()) background = over(layer, background)

    const style = getComputedStyle(el)
    const name = (focused.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)
    const ratio = (color: [number, number, number, number]) => {
      const a = lum(over(color, background))
      const b = lum(background)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }

    const outlineWidth = parseFloat(style.outlineWidth)
    if (style.outlineStyle !== 'none' && outlineWidth > 0) {
      return { tag: focused.tagName, name, kind: 'outline' as const, widthPx: outlineWidth, contrast: ratio(toRgba(style.outlineColor)) }
    }
    // Anel: "<cor> 0px 0px 0px 2px" (cor pode vir antes ou depois dos comprimentos).
    const shadows = style.boxShadow === 'none' ? [] : style.boxShadow.split(/,(?![^(]*\))/).map((s) => s.trim())
    let best: FocusIndicator = { tag: focused.tagName, name, kind: 'nenhum', widthPx: 0, contrast: 0 }
    for (const shadow of shadows) {
      if (shadow.includes('inset')) continue
      const lengths = shadow.match(/-?\d+(\.\d+)?px/g) ?? []
      const spread = parseFloat(lengths[3] ?? '0')
      const color = shadow.replace(/-?\d+(\.\d+)?px/g, '').trim()
      if (spread <= 0 || !color) continue
      const contrast = ratio(toRgba(color))
      if (contrast > best.contrast) best = { tag: focused.tagName, name, kind: 'ring', widthPx: spread, contrast }
    }
    // Campos de formulário trocam também a cor da borda no foco.
    const border = parseFloat(style.borderTopWidth)
    if (best.kind === 'nenhum' && border > 0) {
      best = { tag: focused.tagName, name, kind: 'ring', widthPx: border, contrast: ratio(toRgba(style.borderTopColor)) }
    }
    return best
  })
}

export interface FocusTarget {
  /** Seletor CSS que o elemento focado precisa casar. */
  selector?: string
  /** Texto (fonte de uma RegExp) que o nome acessível ou o texto do elemento focado precisa casar. */
  name?: string
}

/** Aperta Tab até o elemento focado casar com o alvo (devolve quantos Tab foram precisos). */
export async function tabUntil(page: Page, target: FocusTarget, max = 80): Promise<number> {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab')
    const found = await page.evaluate((wanted) => {
      const el = document.activeElement
      if (!el || el === document.body) return false
      if (wanted.selector && !el.matches(wanted.selector)) return false
      if (wanted.name) {
        const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
        if (!new RegExp(wanted.name).test(label)) return false
      }
      return true
    }, target)
    if (found) return i
  }
  throw new Error(`o foco não chegou a ${JSON.stringify(target)} em ${max} Tab`)
}

/** Nome (aria-label ou texto) do elemento que tem o foco agora. */
export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return ''
    return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 60)
  })
}

export async function focusIsInside(page: Page, container: Locator): Promise<boolean> {
  const handle = await container.elementHandle()
  if (!handle) return false
  return page.evaluate((root) => root.contains(document.activeElement), handle)
}

/** Alvos de toque menores que o mínimo (largura ou altura em px CSS); ignora links dentro de texto corrido. */
export async function smallTargets(page: Page, min: number, scope = 'body'): Promise<string[]> {
  return page.evaluate(
    ({ minimum, selector }) => {
      const root = document.querySelector(selector)
      if (!root) return ['(escopo não encontrado)']
      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type="hidden"]), textarea, summary, [role="tab"], [role="button"], [role="menuitem"], [role="menuitemradio"], [role="combobox"]'),
      )
      const small: string[] = []
      for (const el of candidates) {
        if (el.closest('[hidden], [aria-hidden="true"], [inert]')) continue
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        // Rádio/checkbox escondido visualmente: o alvo é o rótulo que o envolve.
        const target = el instanceof HTMLInputElement && ['radio', 'checkbox', 'file'].includes(el.type) ? (el.closest('label') ?? el) : el
        // Link dentro de parágrafo ou item de texto: exceção "em linha" do critério de tamanho de alvo.
        if (el instanceof HTMLAnchorElement) {
          const block = el.closest('p, li, dd, td')
          if (block && (block.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 3) continue
        }
        const rect = target.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        // Skip link só aparece com foco.
        if (el.textContent?.trim() === 'Pular para o conteúdo') continue
        if (rect.width + 0.5 < minimum || rect.height + 0.5 < minimum) {
          small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`)
        }
      }
      return small
    },
    { minimum: min, selector: scope },
  )
}

/** Nomes acessíveis vazios em botões, links e papéis interativos (a partir do snapshot de acessibilidade). */
export async function namelessControls(locator: Locator): Promise<string[]> {
  const snapshot = await locator.ariaSnapshot()
  return snapshot
    .split('\n')
    .filter((line) => /^\s*- (button|link|textbox|searchbox|combobox|spinbutton|checkbox|radio|menuitem|menuitemradio|tab|switch)(\s*\[[^\]]*\])*:?\s*$/.test(line))
}

/** Descrição do estouro horizontal da página (ou null se cabe). */
export async function horizontalOverflow(page: Page): Promise<string | null> {
  const overflow = await page.evaluate(() => {
    // O shell do admin rola dentro do <main>, não no documento: os dois precisam caber na largura.
    const main = document.querySelector('main')
    const doc = document.documentElement
    const width = doc.clientWidth
    const clips = (el: Element) => ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX)
    // Elementos que passam da borda sem um ancestral que recorte ou role (tabela dentro de região rolável é ok).
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        // Passa da borda, ou o conteúdo dele passa (texto sem quebra num elemento que não recorta).
        const spills = !clips(el) && el.scrollWidth > el.clientWidth + 1 && rect.left + el.scrollWidth > width + 1
        return (rect.right > width + 1 || spills) && getComputedStyle(el).position !== 'fixed'
      })
      .filter((el) => {
        // Elemento absoluto só é recortado por quem contém o bloco dele (o primeiro ancestral posicionado) ou por quem está acima.
        let containingBlockFound = getComputedStyle(el).position !== 'absolute'
        for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
          // O <main> é quem rola a página no admin: o que passa dele é o problema, então a busca por recorte para nele.
          if (node === main) break
          if (!containingBlockFound && getComputedStyle(node).position !== 'static') containingBlockFound = true
          if (containingBlockFound && clips(node) && node.getBoundingClientRect().right <= width + 1) return false
        }
        return true
      })
      .slice(0, 4)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).replace(/s+/g, '.').slice(0, 60)} (direita ${Math.round(el.getBoundingClientRect().right)}px, conteúdo ${el.scrollWidth}px)`)
    return {
      scrollWidth: Math.max(doc.scrollWidth, main?.scrollWidth ?? 0),
      clientWidth: width,
      offenders,
    }
  })
  return overflow.scrollWidth > overflow.clientWidth
    ? `rolagem horizontal da página (${overflow.scrollWidth} > ${overflow.clientWidth}); elementos: ${overflow.offenders.join(' | ')}`
    : null
}

export async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  expect(await horizontalOverflow(page), `${label}`).toBeNull()
}
