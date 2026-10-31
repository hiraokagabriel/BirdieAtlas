import { expect, test } from '@playwright/test'
import { expectNoViolations } from '../support/axe.js'
import { prepareWcagData, type WcagData } from '../support/wcag-data.js'
import { settle, useTheme } from '../support/wcag-page.js'

// O que o axe de tela não cobre: as páginas em `@media print` (chave e ranking) e as imagens de
// compartilhamento (PNG). Impressão: axe com a mídia emulada, e o que deve sumir do papel some.
// Imagens: status, tipo e dimensões do PNG (o corpo é gerado pelo Satori; não há DOM para o axe).

let data: WcagData

test.beforeAll(async () => {
  data = await prepareWcagData()
})

test.describe('impressão (@media print)', () => {
  const cases = [
    { name: 'chave do torneio encerrado', path: () => `/t/${data.completed.tournament.slug}`, region: /^Chave de/ },
    { name: 'ranking', path: () => '/r/fpb-sp', region: undefined },
  ] as const

  for (const target of cases) {
    test(`${target.name}: sem violações e sem cromo de navegação`, async ({ page }) => {
      await useTheme(page, 'light')
      await page.goto(target.path())
      if (target.region) await expect(page.getByRole('region', { name: target.region })).toBeVisible()
      else await expect(page.locator('a[href^="/a/"]').first()).toBeVisible()

      // Na tela os botões existem; só então "sumir no papel" quer dizer algo.
      await expect(page.getByRole('button', { name: /Imprimir/ })).toBeVisible()
      await expect(page.getByRole('tablist').or(page.getByRole('button', { name: 'Compartilhar' })).first()).toBeVisible()
      await page.emulateMedia({ media: 'print' })
      await settle(page)

      // Botões (imprimir, compartilhar) e abas ficam fora do papel.
      await expect(page.getByRole('button', { name: /Imprimir/ })).toBeHidden()
      await expect(page.getByRole('button', { name: 'Compartilhar' })).toBeHidden()
      await expect(page.getByRole('tablist')).toBeHidden()
      // O conteúdo principal continua.
      await expect(page.getByRole('main')).toBeVisible()

      await expectNoViolations(page, `${target.name} [impressão]`)
    })
  }
})

test.describe('imagens de compartilhamento', () => {
  /** Dimensões do PNG: IHDR começa no byte 16 (largura e altura, 4 bytes big-endian cada). */
  function pngSize(bytes: Buffer): { width: number; height: number } {
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }

  const images = [
    { name: 'torneio', path: () => `/t/${data.completed.tournament.slug}/share-image`, size: { width: 1200, height: 630 } },
    { name: 'torneio (story)', path: () => `/t/${data.completed.tournament.slug}/share-image?format=portrait`, size: { width: 1080, height: 1350 } },
    { name: 'atleta', path: () => `/a/${data.champion.id}/share-image`, size: { width: 1200, height: 630 } },
    { name: 'ranking', path: () => `/r/fpb-sp/share-image?ranking=${data.ranking.id}`, size: { width: 1200, height: 630 } },
  ] as const

  for (const image of images) {
    test(`${image.name}: PNG com ${image.size.width}x${image.size.height}`, async ({ request }) => {
      const res = await request.get(image.path())
      expect(res.status()).toBe(200)
      expect(res.headers()['content-type']).toContain('image/png')
      expect(pngSize(await res.body())).toEqual(image.size)
    })
  }

  test('torneio inexistente não gera imagem', async ({ request }) => {
    const res = await request.get('/t/nao-existe-mesmo/share-image')
    expect(res.status()).toBe(404)
  })
})
