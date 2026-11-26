import { expect, test } from '@playwright/test'
import { createCategory, createTournament, uniqueTag } from '../support/factories.js'

// Seletor de categoria com muitas categorias: botão com a categoria atual que abre a grade Modalidade × Classe.

test('com muitas categorias, a grade Modalidade × Classe escolhe a categoria e fecha', async ({ page }) => {
  const tag = uniqueTag()
  const tournament = await createTournament({ name: `Muitas Categorias ${tag}`, status: 'registration_open' })
  for (const k of ['A', 'B', 'Sub 15']) {
    await createCategory(tournament.id, { name: `Simples Masculino ${k}`, discipline: 'MS' })
    await createCategory(tournament.id, { name: `Simples Feminino ${k}`, discipline: 'WS' })
    await createCategory(tournament.id, { name: `Duplas Mistas ${k}`, discipline: 'XD' })
  }

  await page.goto(`/admin/tournaments/${tournament.id}`)
  const toggle = page.getByRole('button', { name: /^Categoria: .*9 categorias/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()

  const grid = page.getByRole('group', { name: 'Categoria' })
  // 3 classes × 3 modalidades, cada célula é um radio com o nome da categoria.
  await expect(grid.getByRole('radio')).toHaveCount(9)
  await expect(grid.getByRole('rowheader', { name: 'Sub 15' })).toBeVisible()
  // Pelo teclado: foco no radio e espaço (o visual é a célula; o radio é sr-only).
  await grid.getByRole('radio', { name: 'Duplas Mistas B' }).focus()
  await page.keyboard.press('Space')

  await expect(toggle).toContainText('Duplas Mistas B')
  await expect(page.getByText('Duplas Mistas B —')).toBeVisible()
  // Setas e Home/End só movem o foco; Espaço escolhe. A grade fica aberta.
  const cellOf = (name: string) => grid.getByRole('radio', { name })
  await page.keyboard.press('ArrowDown')
  await expect(cellOf('Duplas Mistas Sub 15')).toBeFocused()
  await expect(cellOf('Duplas Mistas B')).toBeChecked()
  await page.keyboard.press('Home')
  await expect(cellOf('Simples Masculino Sub 15')).toBeFocused()
  await page.keyboard.press('End')
  await expect(cellOf('Duplas Mistas Sub 15')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(cellOf('Duplas Mistas Sub 15')).toBeChecked()
  await expect(toggle).toContainText('Duplas Mistas Sub 15')
  await page.keyboard.press('ArrowUp')
  await expect(cellOf('Duplas Mistas B')).toBeFocused()
  await expect(grid).toBeVisible()

  // Esc fecha e devolve o foco ao botão.
  await page.keyboard.press('Escape')
  await expect(grid).toBeHidden()
  await expect(toggle).toBeFocused()
})
