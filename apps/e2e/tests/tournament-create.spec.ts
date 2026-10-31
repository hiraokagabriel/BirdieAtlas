import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { settle, THEMES, useTheme } from '../support/wcag-page.js'
import {
  completeTournament,
  createRankingWithRules,
  createTournament,
  prepareTournament,
  uniqueTag,
} from '../support/factories.js'

// Criar torneio pela tela (oficial e amistoso) e o que muda em um torneio amistoso: guarda tudo
// (chaves, resultados, colocação) e nunca pontua, mas pode virar oficial depois.

interface TournamentRow {
  id: string
  kind: 'official' | 'friendly'
  status: string
  pointsAwarded: boolean
  slug: string
}

async function fillForm(page: import('@playwright/test').Page, name: string, options: { friendly?: boolean; slug?: string } = {}) {
  await page.goto('/admin/tournaments')
  await page.getByRole('button', { name: 'Novo torneio' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo torneio' })
  if (options.friendly) await dialog.locator('label', { hasText: 'Amistoso' }).click()
  await dialog.getByRole('textbox', { name: /^Nome/ }).fill(name)
  if (options.slug) await dialog.getByLabel('Endereço (slug)').fill(options.slug)
  await dialog.getByLabel('Início').fill('2099-05-10')
  await dialog.getByLabel('Término').fill('2099-05-12')
  return dialog
}

test.describe('criar torneio pela tela', () => {
  test('oficial: cria, abre o torneio e fica em rascunho', async ({ page }) => {
    const name = `Aberto Criado ${uniqueTag()}`
    const dialog = await fillForm(page, name)
    await expect(dialog.getByLabel('Endereço (slug)')).toHaveValue(/^aberto-criado-/) // derivado do nome
    await dialog.getByLabel('Cidade (opcional)').fill('Campinas')
    await dialog.getByRole('button', { name: 'Criar torneio' }).click()

    await expect(page).toHaveURL(/\/admin\/tournaments\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText('Rascunho', { exact: true })).toBeVisible()
    await expect(page.getByText('Amistoso', { exact: true })).toHaveCount(0)

    const id = page.url().split('/').pop()!
    const t = await api.get<TournamentRow>(`/tournaments/${id}`)
    expect(t).toMatchObject({ kind: 'official', status: 'draft' })
  })

  test('amistoso: cria com o selo e o tipo salvo', async ({ page }) => {
    const name = `Amistoso Criado ${uniqueTag()}`
    const dialog = await fillForm(page, name, { friendly: true })
    await dialog.getByRole('button', { name: 'Criar torneio' }).click()

    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText('Amistoso', { exact: true }).first()).toBeVisible()
    const id = page.url().split('/').pop()!
    expect((await api.get<TournamentRow>(`/tournaments/${id}`)).kind).toBe('friendly')

    await page.goto('/admin/tournaments')
    await expect(page.getByRole('link', { name: new RegExp(name) }).getByText('Amistoso', { exact: true })).toBeVisible()
  })

  test('valida os campos e recusa endereço repetido', async ({ page }) => {
    await page.goto('/admin/tournaments')
    await page.getByRole('button', { name: 'Novo torneio' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo torneio' })
    await dialog.getByRole('button', { name: 'Criar torneio' }).click()
    await expect(dialog.getByText('Informe o nome do torneio.')).toBeVisible()
    await expect(dialog.getByText('Informe a data de início.')).toBeVisible()

    await dialog.getByRole('textbox', { name: /^Nome/ }).fill('Qualquer nome')
    await dialog.getByLabel('Início').fill('2099-05-12')
    await dialog.getByLabel('Término').fill('2099-05-10')
    await dialog.getByRole('button', { name: 'Criar torneio' }).click()
    await expect(dialog.getByText('O término não pode ser antes do início.')).toBeVisible()

    const taken = await createTournament()
    await dialog.getByLabel('Término').fill('2099-05-13')
    await dialog.getByLabel('Endereço (slug)').fill(taken.slug)
    await dialog.getByRole('button', { name: 'Criar torneio' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Já existe um torneio com esse endereço')
  })

  for (const theme of THEMES) {
    test(`diálogo de criação sem violações de acessibilidade (${theme})`, async ({ page }) => {
      await useTheme(page, theme)
      await page.goto('/admin/tournaments')
      await page.getByRole('button', { name: 'Novo torneio' }).click()
      await expect(page.getByRole('dialog', { name: 'Novo torneio' })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `novo torneio [${theme}]`)
    })
  }
})

test.describe('torneio amistoso', () => {
  test('guarda a colocação ao encerrar, mas não pontua nem entra em ranking', async () => {
    const anchor = await createRankingWithRules({ year: 2037, level: 'international' })
    const p = await prepareTournament({ athleteCount: 4, level: 'international', kind: 'friendly' })
    await completeTournament(p)

    const regs = await api.get<{ finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    expect(regs.map((r) => r.finalPlacement).sort()).toEqual([1, 2, 3, 3])

    const award = await apiCall<{ code: string }>('POST', `/tournaments/${p.tournament.id}/award-points`)
    expect(award.status).toBe(422)
    expect(award.body.code).toBe('FRIENDLY_TOURNAMENT')

    const link = await apiCall<{ code: string }>('POST', `/rankings/${anchor.id}/tournaments/${p.tournament.id}`)
    expect(link.status).toBe(422)
    expect(link.body.code).toBe('FRIENDLY_TOURNAMENT')

    const entries = await api.get<{ data: unknown[] }>(`/rankings/${anchor.id}/entries`)
    expect(entries.data).toHaveLength(0)
    expect((await api.get<TournamentRow>(`/tournaments/${p.tournament.id}`)).pointsAwarded).toBe(false)
    await apiCall('DELETE', `/rankings/${anchor.id}`)
  })

  test('vira oficial depois e aí pontua; oficial com pontos não volta a amistoso', async () => {
    const anchor = await createRankingWithRules({ year: 2038, level: 'international' })
    const p = await prepareTournament({ athleteCount: 4, level: 'international', kind: 'friendly' })
    await completeTournament(p)

    await api.put(`/tournaments/${p.tournament.id}`, { kind: 'official' })
    const award = await api.post<{ rankings: { id: string }[] }>(`/tournaments/${p.tournament.id}/award-points`)
    expect(award.rankings.map((r) => r.id)).toContain(anchor.id)
    const entries = await api.get<{ data: unknown[] }>(`/rankings/${anchor.id}/entries`)
    expect(entries.data).toHaveLength(4)

    const back = await apiCall<{ code: string }>('PUT', `/tournaments/${p.tournament.id}`, { kind: 'friendly' })
    expect(back.status).toBe(409)
    expect(back.body.code).toBe('POINTS_ALREADY_AWARDED')
    await apiCall('DELETE', `/rankings/${anchor.id}`)
  })

  test('na tela: selo, aviso de que não pontua e troca do tipo em Configurações', async ({ page }) => {
    const p = await prepareTournament({ athleteCount: 4, kind: 'friendly' })
    await completeTournament(p)

    await page.goto(`/admin/tournaments/${p.tournament.id}`)
    await expect(page.getByText('Amistoso', { exact: true }).first()).toBeVisible()
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await expect(page.getByText(/Torneio amistoso: não pontua em rankings/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Distribuir pontos' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'Configurações' }).click()
    await page.getByLabel('Tipo').selectOption('official')
    await page.getByRole('button', { name: /Salvar/ }).first().click()
    await expect.poll(async () => (await api.get<TournamentRow>(`/tournaments/${p.tournament.id}`)).kind).toBe('official')
  })
})
