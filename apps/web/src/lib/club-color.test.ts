import { describe, expect, it } from 'vitest'
import { clubInkColor, clubInkContrastOnLightTheme, clubInkMixForLightTheme, clubInkOnWhite } from './club-color'

describe('cor de marca do clube como texto', () => {
  it('chega a 4,5:1 contra o fundo claro para qualquer cor cadastrada', () => {
    const cores = ['#6366f1', '#facc15', '#ffffff', '#000000', '#22c55e', '#f97316', '#a5b4fc', '#e11d48', '#0ea5e9']
    for (const cor of cores) {
      expect(clubInkContrastOnLightTheme(cor), cor).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('não mexe numa cor que já tem contraste', () => {
    expect(clubInkMixForLightTheme('#000000')).toBe(0)
  })

  it('escurece mais uma cor clara do que uma escura', () => {
    expect(clubInkMixForLightTheme('#facc15')).toBeGreaterThan(clubInkMixForLightTheme('#6366f1'))
  })

  it('formato desconhecido recebe a mistura de segurança', () => {
    expect(clubInkMixForLightTheme('azul')).toBe(60)
  })

  it('mistura em direção ao texto do tema, respeitando o mínimo do tema escuro', () => {
    expect(clubInkColor('#6366f1')).toContain('max(var(--club-ink-mix),')
    expect(clubInkOnWhite('#6366f1')).toMatch(/^color-mix\(in oklab, #6366f1, oklch\(0\.22 0\.03 160\) \d+%\)$/)
  })
})
