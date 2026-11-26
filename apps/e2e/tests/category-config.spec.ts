import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { createTournament, prepareTournament, uniqueTag } from '../support/factories.js'

// Configuração da categoria: pontuação (ex.: 15 pontos), padrão de grupos, edição e exclusão; a regra
// vale no diálogo de resultado e na API.

const R15 = { pointsPerSet: 15, setPointCap: 21, setsToWin: 2 }

test('cria categoria de grupos com 15 pontos, edita e exclui', async ({ page }) => {
  const tournament = await createTournament({ status: 'draft' })
  await page.goto(`/admin/tournaments/${tournament.id}`)
  await page.getByRole('tab', { name: 'Configurações' }).click()

  const form = page.getByRole('group', { name: 'Adicionar categoria' })
  await form.getByLabel('Nome da categoria').fill('Simples Masculino A')
  await form.getByLabel('Formato da chave').selectOption('group_then_elimination')
  await form.getByLabel('Número de grupos').fill('3')
  await form.getByLabel('Sistema').selectOption('15x3')
  await page.getByRole('button', { name: 'Criar categoria' }).click()

  const row = page.getByRole('listitem').filter({ hasText: 'Simples Masculino A' })
  await expect(row).toContainText('Grupos + eliminatória · 15 pontos, melhor de 3 (teto 21)')
  const [cat] = await api.get<{ id: string; drawConfig: unknown; pointsPerSet: number }[]>(`/tournaments/${tournament.id}/categories`)
  expect(cat?.drawConfig).toEqual({ groupCount: 3 })

  await row.getByRole('button', { name: 'Editar Simples Masculino A' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar categoria' })
  await dialog.getByLabel('Nome da categoria').fill('Simples Masculino B')
  await dialog.getByLabel('Sistema').selectOption('custom')
  await dialog.getByLabel('Pontos do set').fill('11')
  await dialog.getByLabel('Teto').fill('11')
  await dialog.getByLabel('Partida').selectOption('3')
  await expect(dialog.getByText('Fica: 11 pontos, melhor de 5.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Salvar categoria' }).click()
  await expect(dialog).toBeHidden()
  const edited = page.getByRole('listitem').filter({ hasText: 'Simples Masculino B' })
  await expect(edited).toContainText('11 pontos, melhor de 5')

  await edited.getByRole('button', { name: 'Excluir Simples Masculino B' }).click()
  await page.getByRole('dialog', { name: 'Excluir categoria?' }).getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByText('Nenhuma categoria ainda.')).toBeVisible()
})

test('diálogo de resultado segue os 15 pontos da categoria', async ({ page }) => {
  const prepared = await prepareTournament({ athleteCount: 4, name: `Quinze E2E ${uniqueTag()}` })
  await api.patch(`/tournaments/categories/${prepared.category.id}`, { scoring: R15 })

  await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
  await page.getByRole('tab', { name: 'Chaveamento' }).click()
  await page.getByRole('button', { name: /^(?!.*vencedor).*Abrir resultado/ }).first().click()

  const dialog = page.getByRole('dialog', { name: 'Lançar resultado' })
  await expect(dialog).toContainText('15 pontos, melhor de 3 (teto 21)')
  const scores = dialog.getByRole('spinbutton')
  await scores.nth(0).fill('21')
  await scores.nth(1).fill('15')
  await scores.nth(2).fill('21')
  await scores.nth(3).fill('15')
  await dialog.getByRole('button', { name: 'Confirmar resultado' }).click()
  await expect(dialog.getByRole('alert')).toContainText('o set acaba em 15 com 2 de vantagem, ou em 21')

  await scores.nth(0).fill('15')
  await scores.nth(1).fill('10')
  await scores.nth(2).fill('16')
  await scores.nth(3).fill('14')
  await expect(dialog.getByRole('status')).toHaveText(/^Vitória de .+ por 2 sets a 0$/)
  await dialog.getByRole('button', { name: 'Confirmar resultado' }).click()
  await expect(dialog).toBeHidden()
})

test('API: placar fora da regra e formato depois do sorteio são recusados', async () => {
  const prepared = await prepareTournament({ athleteCount: 4, name: `Regra E2E ${uniqueTag()}` })
  await api.patch(`/tournaments/categories/${prepared.category.id}`, { scoring: R15 })
  const match = prepared.matches.find((m) => m.registration1Id && m.registration2Id)!

  const bad = await apiCall('POST', `/draws/matches/${match.id}/result`, {
    sets: [{ setNumber: 1, score1: 21, score2: 12 }, { setNumber: 2, score1: 21, score2: 12 }], status: 'completed',
  })
  expect(bad.status).toBe(422)
  expect((bad.body as { code: string }).code).toBe('INVALID_SCORE')

  const format = await apiCall('PATCH', `/tournaments/categories/${prepared.category.id}`, { drawType: 'round_robin' })
  expect(format.status).toBe(409)
  expect((format.body as { code: string }).code).toBe('CATEGORY_HAS_DRAW')

  await api.post(`/draws/matches/${match.id}/result`, {
    sets: [{ setNumber: 1, score1: 15, score2: 3 }, { setNumber: 2, score1: 21, score2: 20 }], status: 'completed',
  })
  const scoring = await apiCall('PATCH', `/tournaments/categories/${prepared.category.id}`, { scoring: { pointsPerSet: 21, setPointCap: 30, setsToWin: 2 } })
  expect(scoring.status).toBe(409)
  expect((scoring.body as { code: string }).code).toBe('CATEGORY_HAS_RESULTS')

  const remove = await apiCall('DELETE', `/tournaments/categories/${prepared.category.id}`)
  expect(remove.status).toBe(409)
})
