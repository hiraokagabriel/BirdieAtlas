import { expect, test, type Page } from '@playwright/test'

// Tema claro/escuro/sistema: escolha persistida, sem flash na carga e seguindo o `prefers-color-scheme`.

const STORAGE_KEY = 'birdie-theme'

/** Registra, antes de qualquer script da página, o estado da classe `dark` a cada mudança e no DOMContentLoaded. */
async function trackDarkClass(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Este script roda antes de o <html> existir: observa o `document` inteiro e filtra pelo elemento raiz.
    const history: boolean[] = []
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === document.documentElement) history.push(document.documentElement.classList.contains('dark'))
      }
    }).observe(document, { attributes: true, attributeFilter: ['class'], subtree: true })
    document.addEventListener('DOMContentLoaded', () => {
      Reflect.set(window, '__darkAtDomContentLoaded', document.documentElement.classList.contains('dark'))
    })
    Reflect.set(window, '__darkHistory', history)
  })
}

const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('dark'))
const storedTheme = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)

async function chooseTheme(page: Page, label: 'Claro' | 'Escuro' | 'Sistema'): Promise<void> {
  await page.getByRole('button', { name: 'Alterar tema' }).click()
  await page.getByRole('menuitemradio', { name: label }).click()
}

test.describe('escolha explícita', () => {
  test('escuro persiste após recarregar e a classe já existe no DOMContentLoaded (sem flash)', async ({ page }) => {
    await page.goto('/')
    expect(await isDark(page)).toBe(false)

    await chooseTheme(page, 'Escuro')
    await expect.poll(() => isDark(page)).toBe(true)
    expect(await storedTheme(page)).toBe('dark')
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark')

    await trackDarkClass(page)
    await page.reload({ waitUntil: 'domcontentloaded' })

    // O script bloqueante do <head> definiu a classe antes da primeira pintura.
    expect(await page.evaluate(() => Reflect.get(window, '__darkAtDomContentLoaded'))).toBe(true)
    // E ela nunca foi removida e recolocada (flash de tema claro): nenhuma mudança registrada foi para `false`.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const history = await page.evaluate(() => Reflect.get(window, '__darkHistory') as boolean[])
    expect(history).not.toContain(false)
    expect(await isDark(page)).toBe(true)

    // O menu reflete a escolha salva.
    await page.getByRole('button', { name: 'Alterar tema' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Escuro' })).toBeChecked()
    await expect(page.getByRole('menuitemradio', { name: 'Claro' })).not.toBeChecked()
  })

  test('a escolha vale nas outras páginas, inclusive no admin', async ({ page }) => {
    await page.goto('/')
    await chooseTheme(page, 'Escuro')
    await page.goto('/admin/athletes')
    await expect(page.getByRole('heading', { level: 1, name: 'Atletas' })).toBeVisible()
    expect(await isDark(page)).toBe(true)

    await chooseTheme(page, 'Claro')
    await expect.poll(() => isDark(page)).toBe(false)
    expect(await storedTheme(page)).toBe('light')
    await page.goto('/')
    expect(await isDark(page)).toBe(false)
  })

  test('"Claro" vence o sistema escuro', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await isDark(page)).toBe(true) // sem escolha salva, segue o sistema

    await chooseTheme(page, 'Claro')
    await expect.poll(() => isDark(page)).toBe(false)
    await page.reload()
    expect(await isDark(page)).toBe(false)
  })

  test('um valor corrompido no storage cai em "sistema"', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'azul-turquesa'), STORAGE_KEY)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await isDark(page)).toBe(true)
    await page.getByRole('button', { name: 'Alterar tema' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Sistema' })).toBeChecked()
  })
})

test.describe('modo sistema', () => {
  test('segue o prefers-color-scheme na carga e quando o sistema muda', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    expect(await isDark(page)).toBe(false)
    expect(await storedTheme(page)).toBeNull()

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => isDark(page)).toBe(true)
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => isDark(page)).toBe(false)
  })

  test('voltar a "Sistema" apaga a escolha salva e volta a seguir o sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await chooseTheme(page, 'Escuro')
    expect(await storedTheme(page)).toBe('dark')

    await chooseTheme(page, 'Sistema')
    await expect.poll(() => isDark(page)).toBe(false)
    expect(await storedTheme(page)).toBeNull()

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => isDark(page)).toBe(true)
  })

  test('sistema escuro já chega escuro, sem flash', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark', baseURL: test.info().project.use.baseURL ?? '' })
    const page = await context.newPage()
    await trackDarkClass(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(await page.evaluate(() => Reflect.get(window, '__darkAtDomContentLoaded'))).toBe(true)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, '__darkHistory') as boolean[])).not.toContain(false)
    await context.close()
  })
})
