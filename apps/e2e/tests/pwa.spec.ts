import { expect, test } from '@playwright/test'

// App instalável (PWA): manifesto, ícones, service worker e página sem conexão.
// O E2E roda em localhost com build de produção, que é um contexto seguro: o service worker registra.

interface Manifest {
  name: string
  short_name: string
  start_url: string
  display: string
  theme_color: string
  icons: { src: string; sizes: string; type: string; purpose?: string }[]
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

test.describe('manifesto e ícones', () => {
  test('o manifesto declara o app instalável e a página aponta para ele', async ({ page, request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)
    const manifest = (await res.json()) as Manifest
    expect(manifest).toMatchObject({ name: 'BirdieAtlas', start_url: '/', display: 'standalone' })
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)

    await page.goto('/')
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', manifest.theme_color)
  })

  test('cada ícone do manifesto é um PNG do tamanho declarado', async ({ request }) => {
    const manifest = (await (await request.get('/manifest.webmanifest')).json()) as Manifest
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src)
      expect(res.status(), icon.src).toBe(200)
      expect(res.headers()['content-type']).toContain('image/png')
      const [w, h] = icon.sizes.split('x').map(Number)
      expect(pngSize(await res.body()), icon.src).toEqual({ width: w, height: h })
    }
    expect((await request.get('/pwa-icon/180')).status()).toBe(200) // ícone da Apple
    expect((await request.get('/pwa-icon/999')).status()).toBe(404)
  })
})

test.describe('service worker', () => {
  test('é servido sem cache e como JavaScript', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('javascript')
    expect(res.headers()['cache-control']).toContain('no-cache')
  })

  test('registra, controla a página e guarda a página sem conexão e os arquivos estáticos', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    // O worker assume as abas já abertas (clients.claim); recarrega para garantir o controle.
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

    // Pré-cache: a página mostrada quando a navegação falha por falta de rede.
    const cached = await page.evaluate(async () => {
      const cache = await caches.open('birdie-static-v1')
      return (await cache.keys()).map((r) => new URL(r.url).pathname)
    })
    expect(cached).toContain('/offline')

    // Nada de páginas nem da API em cache: só /offline e arquivos estáticos.
    await page.goto('/r/fpb-sp')
    const afterVisit = await page.evaluate(async () => {
      const cache = await caches.open('birdie-static-v1')
      return (await cache.keys()).map((r) => new URL(r.url).pathname)
    })
    expect(afterVisit).not.toContain('/r/fpb-sp')
    expect(afterVisit.every((p) => p === '/offline' || p.startsWith('/_next/static/') || p.startsWith('/pwa-icon/'))).toBe(true)
  })

  test('a página sem conexão também abre online', async ({ page }) => {
    await page.goto('/offline')
    await expect(page.getByRole('heading', { level: 1, name: 'Sem conexão' })).toBeVisible()
  })
})
