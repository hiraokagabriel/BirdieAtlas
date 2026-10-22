import { expect, type Page } from '@playwright/test'

// Preparação comum dos specs de acessibilidade: tema, viewport e "página assentada" (sem animação em curso).

export type Theme = 'light' | 'dark'

export const THEMES: readonly Theme[] = ['light', 'dark']

export interface ViewportCase {
  name: 'desktop' | 'mobile'
  width: number
  height: number
}

export const VIEWPORTS: readonly ViewportCase[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

/** Escolhe o tema pelo mesmo mecanismo do app (`localStorage` lido pelo script do <head>), antes da 1ª carga. */
export async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('birdie-theme', value), theme)
}

/** Espera as animações finitas (fade/zoom de diálogos) terminarem: o axe mede o contraste com as cores finais. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)))
  })
}

export async function expectTheme(page: Page, theme: Theme): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark')
}
