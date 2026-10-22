import { test } from '@playwright/test'
import { expectNoViolations } from '../support/axe.js'
import { prepareWcagData, type WcagData } from '../support/wcag-data.js'
import { adminPages, publicPages } from '../support/wcag-routes.js'
import { expectTheme, settle, THEMES, useTheme, VIEWPORTS } from '../support/wcag-page.js'

// Auditoria WCAG 2.1 AA (axe-core) de TODAS as rotas, públicas e do admin, com dados reais, nos temas claro e
// escuro e nos viewports desktop (1280) e celular (390). Os overlays (diálogos, sheet, menus) ficam em
// `wcag-overlays.spec.ts`; o que o axe não enxerga, em `wcag-targeted.spec.ts`.

let data: WcagData

test.beforeAll(async () => {
  data = await prepareWcagData()
})

for (const [group, pages] of [
  ['público', publicPages(() => data)],
  ['admin', adminPages(() => data)],
] as const) {
  test.describe(`WCAG axe: ${group}`, () => {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        test.describe(`${theme}, ${viewport.name}`, () => {
          test.use({ viewport: { width: viewport.width, height: viewport.height } })
          for (const target of pages) {
            test(target.name, async ({ page }) => {
              await useTheme(page, theme)
              await page.goto(target.path())
              await target.ready(page)
              await expectTheme(page, theme)
              await settle(page)
              await expectNoViolations(page, `${target.name} [${theme}, ${viewport.name}]`)
            })
          }
        })
      }
    }
  })
}
