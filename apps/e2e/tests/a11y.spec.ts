import { expect, test, type Page } from '@playwright/test'
import {
  affiliate,
  createAthlete,
  createClub,
  prepareTournament,
  type Athlete,
  type Club,
  type PreparedTournament,
} from '../support/factories.js'

// Fumaça de acessibilidade só com o Playwright (sem axe): estrutura, pontos de referência (landmarks),
// imagens com alt, nome acessível nos controles e foco visível no primeiro Tab. A auditoria WCAG 2.1 AA completa
// (axe em todas as rotas, temas, viewports e overlays, mais verificações de teclado e foco) está em
// `wcag.spec.ts`, `wcag-overlays.spec.ts` e `wcag-targeted.spec.ts`.

interface PageCase {
  name: string
  path: () => string
  /** Algo que só existe com a página carregada com dados. */
  ready: (page: Page) => ReturnType<Page['locator']>
}

let prepared: PreparedTournament
let athlete: Athlete
let club: Club

test.beforeAll(async () => {
  club = await createClub()
  athlete = await createAthlete()
  await affiliate(athlete.id, club.id)
  prepared = await prepareTournament({ name: `A11y E2E ${Date.now().toString(36)}` })
})

const publicPages: PageCase[] = [
  { name: 'início', path: () => '/', ready: (p) => p.getByRole('region', { name: 'Top 10 dos rankings' }).getByRole('tablist') },
  { name: 'ranking', path: () => '/r/fpb-sp', ready: (p) => p.getByRole('radio', { name: /Simples|Duplas/ }).first() },
  { name: 'torneio', path: () => `/t/${prepared.tournament.slug}`, ready: (p) => p.getByRole('region', { name: /^Chave de/ }) },
  { name: 'atleta', path: () => `/a/${athlete.id}`, ready: (p) => p.getByRole('heading', { level: 1, name: athlete.name }) },
  { name: 'clube', path: () => `/c/${club.slug}`, ready: (p) => p.getByRole('heading', { level: 1, name: club.name }) },
]

const adminPages: PageCase[] = [
  { name: 'dashboard', path: () => '/admin', ready: (p) => p.getByRole('heading', { level: 1, name: 'Dashboard' }) },
  { name: 'atletas', path: () => '/admin/athletes', ready: (p) => p.getByRole('table') },
  { name: 'duplas', path: () => '/admin/pairs', ready: (p) => p.getByRole('heading', { name: 'Duplas' }) },
  { name: 'clubes', path: () => '/admin/clubs', ready: (p) => p.getByRole('heading', { level: 2, name: 'Clubes' }) },
  { name: 'torneios', path: () => '/admin/tournaments', ready: (p) => p.getByRole('heading', { level: 2, name: 'Torneios' }) },
  {
    name: 'torneio (detalhe)',
    path: () => `/admin/tournaments/${prepared.tournament.id}`,
    ready: (p) => p.getByRole('heading', { level: 2, name: prepared.tournament.name }),
  },
  { name: 'ao vivo', path: () => '/admin/live', ready: (p) => p.getByRole('heading', { level: 2, name: 'Placar ao vivo' }) },
  { name: 'rankings', path: () => '/admin/rankings', ready: (p) => p.getByRole('heading', { level: 2, name: 'Rankings' }) },
]

async function openReady(page: Page, target: PageCase): Promise<void> {
  await page.goto(target.path())
  await expect(target.ready(page).first()).toBeVisible()
}

for (const [group, pages] of [
  ['público', publicPages],
  ['admin', adminPages],
] as const) {
  test.describe(`acessibilidade: ${group}`, () => {
    for (const target of pages) {
      test(`${target.name}: um h1, landmarks, idioma, título e imagens com alt`, async ({ page }) => {
        await openReady(page, target)

        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
        await expect(page.getByRole('main')).toHaveCount(1)
        await expect(page.getByRole('banner')).toHaveCount(1)
        expect(await page.getByRole('navigation').count()).toBeGreaterThanOrEqual(1)

        expect(await page.locator('html').getAttribute('lang')).toBe('pt-BR')
        expect((await page.title()).trim().length).toBeGreaterThan(0)

        // Toda <img> tem o atributo alt (vazio é válido para decorativas).
        const withoutAlt = await page.evaluate(() =>
          Array.from(document.querySelectorAll('img:not([alt])')).map((img) => img.getAttribute('src') ?? '(sem src)'),
        )
        expect(withoutAlt).toEqual([])
      })

      test(`${target.name}: o primeiro Tab leva a um controle com foco visível`, async ({ page }) => {
        await openReady(page, target)
        await page.keyboard.press('Tab')

        const focused = page.locator(':focus-visible')
        await expect(focused).toHaveCount(1)
        const tag = await focused.evaluate((element) => element.tagName)
        expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']).toContain(tag)

        const indicator = await focused.evaluate((element) => {
          const style = getComputedStyle(element)
          return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow }
        })
        const hasOutline = indicator.outlineStyle !== 'none' && indicator.outlineWidth !== '0px'
        const hasRing = indicator.boxShadow !== 'none'
        expect(hasOutline || hasRing, `sem indicador de foco: ${JSON.stringify(indicator)}`).toBe(true)
      })

      test(`${target.name}: botões, links e campos têm nome acessível`, async ({ page }) => {
        await openReady(page, target)
        const snapshot = await page.locator('body').ariaSnapshot()
        // Linha do tipo `- button` ou `- link:` (papel interativo sem texto entre aspas).
        const nameless = snapshot
          .split('\n')
          .filter((line) => /^\s*- (button|link|textbox|searchbox|combobox|spinbutton|checkbox|radio|menuitem|tab)(\s*\[[^\]]*\])*:?\s*$/.test(line))
        expect(nameless, 'controles sem nome acessível').toEqual([])
      })
    }
  })
}

test(
  'a tela "Torneio não encontrado" tem um h1',
  async ({ page }) => {
    await page.goto('/t/torneio-que-nao-existe')
    await expect(page.getByRole('heading', { name: 'Torneio não encontrado' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  },
)
