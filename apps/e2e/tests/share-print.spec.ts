import { expect, test } from '@playwright/test'
import { WEB_URL, TENANT_SLUG } from '../support/env.js'
import { expectNoViolations } from '../support/axe.js'
import { completeTournament, prepareTournament, type PreparedTournament } from '../support/factories.js'

// Imagens de compartilhamento e impressão: o axe não cobre nenhuma das duas (PNG e `@media print`), então
// elas têm testes próprios. Torneio de simples masculino, encerrado pela API.

let prepared: PreparedTournament
let championId: string

test.beforeAll(async () => {
  prepared = await prepareTournament({ name: `Compartilhar ${Date.now().toString(36)}` })
  const report = await completeTournament(prepared)
  championId = report.report[0]?.podium.find((p) => p.placement === 1)?.athleteId ?? ''
  if (!championId) throw new Error('O encerramento não devolveu o campeão.')
})

interface Png {
  status: number
  contentType: string
  width: number
  height: number
  headers: Record<string, string>
}

/** Largura e altura vêm do chunk IHDR (bytes 16 a 23 do PNG). */
async function fetchPng(path: string): Promise<Png> {
  const res = await fetch(`${WEB_URL}${path}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  const isPng = bytes.subarray(1, 4).toString('ascii') === 'PNG'
  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    width: isPng ? bytes.readUInt32BE(16) : 0,
    height: isPng ? bytes.readUInt32BE(20) : 0,
    headers: Object.fromEntries(res.headers.entries()),
  }
}

test.describe('imagens de compartilhamento', () => {
  test('torneio: 1200x630 e a versão "story" 1080x1350', async () => {
    const landscape = await fetchPng(`/t/${prepared.tournament.slug}/share-image`)
    expect(landscape).toMatchObject({ status: 200, width: 1200, height: 630 })
    expect(landscape.contentType).toContain('image/png')

    const portrait = await fetchPng(`/t/${prepared.tournament.slug}/share-image?format=portrait`)
    expect(portrait).toMatchObject({ status: 200, width: 1080, height: 1350 })
  })

  test('atleta e ranking: 1200x630', async () => {
    expect(await fetchPng(`/a/${championId}/share-image`)).toMatchObject({ status: 200, width: 1200, height: 630 })
    expect(await fetchPng(`/r/${TENANT_SLUG}/share-image`)).toMatchObject({ status: 200, width: 1200, height: 630 })
  })

  test('?download=1 entrega o PNG como anexo com nome em slug', async () => {
    const res = await fetch(`${WEB_URL}/t/${prepared.tournament.slug}/share-image?download=1`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="?[a-z0-9-]+\.png/)
  })

  test('dado inexistente devolve a imagem de fallback com 404, nunca 500', async () => {
    for (const path of ['/t/nao-existe-e2e/share-image', '/a/nao-existe-e2e/share-image']) {
      const png = await fetchPng(path)
      expect(png.status, path).toBe(404)
      expect(png.contentType, path).toContain('image/png')
      expect(png.width, path).toBeGreaterThan(0)
    }
  })
})

test.describe('impressão (@media print)', () => {
  test('a chave imprime sem cabeçalho nem controles e continua sem violações do axe', async ({ page }) => {
    await page.goto(`/t/${prepared.tournament.slug}`)
    const print = page.getByRole('button', { name: /Imprimir/ })
    await expect(print).toBeVisible()
    await expect(page.getByRole('banner')).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    await expect(print).toBeHidden()
    await expect(page.getByRole('banner')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: prepared.tournament.name })).toBeVisible()
    await expectNoViolations(page, 'torneio público em modo de impressão')

    await page.emulateMedia({ media: 'screen' })
    await expect(print).toBeVisible()
    await expect(page.getByRole('banner')).toBeVisible()
  })

  test('o ranking imprime sem cabeçalho nem botões', async ({ page }) => {
    await page.goto(`/r/${TENANT_SLUG}`)
    const print = page.getByRole('button', { name: /Imprimir/ })
    await expect(print).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(print).toBeHidden()
    await expect(page.getByRole('banner')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: 'Ranking' })).toBeVisible()
  })

  test('o botão de imprimir chama window.print e força o tema claro durante a impressão', async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => {
        window.dispatchEvent(new Event('beforeprint'))
        Reflect.set(window, '__darkDuringPrint', document.documentElement.classList.contains('dark'))
        window.dispatchEvent(new Event('afterprint'))
      }
      localStorage.setItem('theme', 'dark')
    })
    await page.goto(`/t/${prepared.tournament.slug}`)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.getByRole('button', { name: /Imprimir/ }).click()
    expect(await page.evaluate(() => Reflect.get(window, '__darkDuringPrint'))).toBe(false)
  })
})
