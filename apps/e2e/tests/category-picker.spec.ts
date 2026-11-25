import { expect, test } from '@playwright/test'
import { createCategory, createTournament, uniqueTag } from '../support/factories.js'

// Seletor de categoria com muitas categorias: busca pelo nome e filtros de modalidade e classe.

test('com muitas categorias, a busca e os filtros reduzem as pílulas e "Limpar filtros" volta tudo', async ({ page }) => {
  const tag = uniqueTag()
  const tournament = await createTournament({ name: `Muitas Categorias ${tag}`, status: 'registration_open' })
  const classes = ['A', 'B', 'Sub 15']
  for (const k of classes) {
    await createCategory(tournament.id, { name: `Simples Masculino ${k}`, discipline: 'MS' })
    await createCategory(tournament.id, { name: `Simples Feminino ${k}`, discipline: 'WS' })
    await createCategory(tournament.id, { name: `Duplas Mistas ${k}`, discipline: 'XD' })
  }

  await page.goto(`/admin/tournaments/${tournament.id}`)
  const pills = page.getByRole('group', { name: 'Categoria' }).getByRole('radio')
  await expect(pills).toHaveCount(9)

  await page.getByRole('searchbox', { name: 'Buscar categoria' }).fill('sub 15')
  await expect(page.getByText('3 de 9 categorias')).toBeVisible()
  await expect(pills).toHaveCount(3)
  await page.getByRole('searchbox', { name: 'Buscar categoria' }).fill('zzz')
  await expect(page.getByText('Nenhuma categoria com esse filtro.')).toBeVisible()

  await page.getByRole('button', { name: 'Limpar filtros' }).first().click()
  await page.getByText('Filtros', { exact: true }).click()
  await page.getByRole('group', { name: 'Modalidade' }).getByText('Duplas mistas').click()
  await page.getByRole('group', { name: 'Classe' }).getByText('B', { exact: true }).click()
  await expect(page.getByText('1 de 9 categorias')).toBeVisible()
  await page.getByRole('group', { name: 'Categoria' }).getByText('Duplas Mistas B').click()
  await expect(page.getByRole('group', { name: 'Categoria' }).getByRole('radio', { name: 'Duplas Mistas B' })).toBeChecked()
})
