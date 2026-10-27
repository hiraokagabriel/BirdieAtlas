import { expect, test, type Page } from '@playwright/test'
import { api } from '../support/api.js'
import { createAthlete, createAthletes, createClub, uniqueTag } from '../support/factories.js'

// Cadastros no painel admin: atletas, importação de CSV, clubes e duplas. Cada teste cria o que precisa
// pela API e confere o resultado pela interface e pela API.

interface Paged<T> {
  data: T[]
}

interface AthleteRow {
  id: string
  name: string
  email: string | null
}

interface ClubRow {
  id: string
  name: string
  slug: string
}

interface PairRow {
  id: string
  active: boolean
  discipline: string
}

const dialog = (page: Page) => page.getByRole('dialog')

/** Os radios do `ChoiceGroup` são `sr-only`: o clique vai no rótulo que os envolve. */
const choose = (page: Page, name: string | RegExp) =>
  dialog(page).locator('label').filter({ has: page.getByRole('radio', { name }) }).click()

test.describe('atletas', () => {
  test('cadastra um atleta pela interface e o encontra na lista', async ({ page }) => {
    const name = `Cadastro Atleta ${uniqueTag()}`
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Novo atleta' }).click()
    await dialog(page).getByLabel('Nome completo').fill(name)
    await choose(page, 'Feminino')
    await dialog(page).getByRole('button', { name: 'Criar atleta' }).click()
    await expect(dialog(page)).toBeHidden()

    await page.getByRole('searchbox', { name: /Buscar atletas/ }).fill(name)
    await expect(page.getByRole('button', { name })).toBeVisible()

    const found = await api.get<Paged<AthleteRow & { gender: string }>>(`/athletes?search=${encodeURIComponent(name)}`)
    expect(found.data.map((a) => a.name)).toContain(name)
    expect(found.data.find((a) => a.name === name)?.gender).toBe('F')
  })

  test('nome vazio mostra o erro do campo e não fecha o diálogo', async ({ page }) => {
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Novo atleta' }).click()
    await dialog(page).getByRole('button', { name: 'Criar atleta' }).click()
    await expect(dialog(page).getByLabel('Nome completo')).toBeFocused()
    await expect(dialog(page).getByText(/nome/i).filter({ hasText: /obrigat|informe|preench/i }).first()).toBeVisible()
    await expect(dialog(page)).toBeVisible()
  })

  test('e-mail já usado devolve o erro da API no diálogo', async ({ page }) => {
    const email = `duplicado.${uniqueTag()}@example.com`
    await createAthlete({ email })
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Novo atleta' }).click()
    await dialog(page).getByLabel('Nome completo').fill(`Outro Atleta ${uniqueTag()}`)
    await dialog(page).getByLabel('E-mail (opcional)').fill(email)
    await dialog(page).getByRole('button', { name: 'Criar atleta' }).click()
    await expect(dialog(page).getByRole('alert')).toBeVisible()
    await expect(dialog(page)).toBeVisible()
  })
})

test.describe('importação de CSV', () => {
  test('mostra a prévia, importa as linhas válidas e relata a que falhou', async ({ page }) => {
    const tag = uniqueTag()
    const good1 = `Importada Um ${tag}`
    const good2 = `Importada Dois ${tag}`
    const csv = [
      'name,gender,birthDate,email,nationality',
      `${good1},M,1995-03-20,um.${tag}@example.com,BR`,
      `${good2},F,1998-07-15,,BR`,
      `Sem Gênero ${tag},X,1990-01-01,,BR`,
    ].join('\n')

    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Importar CSV' }).click()
    await expect(dialog(page)).toHaveAccessibleName(/Importar atletas/)
    await dialog(page).locator('input[type="file"]').setInputFiles({
      name: 'atletas.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    })

    await expect(dialog(page).getByRole('region', { name: 'Pré-visualização do CSV' })).toContainText(good1)
    await dialog(page).getByRole('button', { name: 'Importar 3 atletas' }).click()

    const status = dialog(page).getByRole('status')
    await expect(status).toContainText('2 importados')
    await expect(status).toContainText('1 com erro')
    await expect(status).toContainText('Linha')
    await dialog(page).getByRole('button', { name: 'Fechar', exact: true }).click()

    const found = await api.get<Paged<AthleteRow>>(`/athletes?search=${tag}`)
    // Só as duas linhas válidas entraram: a de gênero inválido foi rejeitada (a busca pela tag acharia as três).
    expect(found.data.map((a) => a.name).sort()).toEqual([good1, good2].sort())
  })

  test('sem linhas de dados não oferece o botão de importar', async ({ page }) => {
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Importar CSV' }).click()
    await dialog(page).locator('input[type="file"]').setInputFiles({
      name: 'vazio.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,gender\n', 'utf-8'),
    })
    await expect(dialog(page).getByRole('button', { name: /^Importar \d/ })).toHaveCount(0)
  })
})

test.describe('clubes', () => {
  test('cria um clube, edita o nome e confere na lista', async ({ page }) => {
    const tag = uniqueTag()
    const name = `Clube Cadastro ${tag}`
    const renamed = `Clube Renomeado ${tag}`

    await page.goto('/admin/clubs')
    await page.getByRole('button', { name: 'Novo clube' }).click()
    await dialog(page).getByLabel('Nome do clube').fill(name)
    await dialog(page).getByLabel('Slug').fill(`clube-cadastro-${tag}`)
    await dialog(page).getByLabel('Cidade (opcional)').fill('Campinas')
    await dialog(page).getByRole('button', { name: 'Criar clube' }).click()
    await expect(dialog(page)).toBeHidden()

    await page.getByRole('searchbox', { name: 'Buscar clube' }).fill(name)
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()

    await page.getByRole('button', { name: 'Editar clube' }).click()
    await dialog(page).getByLabel('Nome do clube').fill(renamed)
    await dialog(page).getByRole('button', { name: /Salvar/ }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible()

    const club = await api.get<ClubRow>(`/clubs/by-slug/clube-cadastro-${tag}`)
    expect(club.name).toBe(renamed)
  })

  test('slug repetido devolve o erro no diálogo', async ({ page }) => {
    const existing = await createClub()
    await page.goto('/admin/clubs')
    await page.getByRole('button', { name: 'Novo clube' }).click()
    await dialog(page).getByLabel('Nome do clube').fill(`Outro ${uniqueTag()}`)
    await dialog(page).getByLabel('Slug').fill(existing.slug)
    await dialog(page).getByRole('button', { name: 'Criar clube' }).click()
    await expect(dialog(page).getByRole('alert')).toBeVisible()
    await expect(dialog(page)).toBeVisible()
  })
})

test.describe('duplas', () => {
  test('cria uma dupla masculina, vê na lista e a desativa', async ({ page }) => {
    const [a, b] = await createAthletes(2, { gender: 'M', prefix: 'Dupla' })
    if (!a || !b) throw new Error('Atletas não criados.')

    await page.goto('/admin/pairs')
    await page.getByRole('button', { name: 'Nova dupla' }).first().click()
    for (const [label, athlete] of [['Atleta 1', a], ['Atleta 2', b]] as const) {
      await dialog(page).getByRole('button', { name: new RegExp(label) }).click()
      await dialog(page).getByPlaceholder('Buscar atleta...').fill(athlete.name)
      await dialog(page).getByRole('button', { name: new RegExp(athlete.name) }).click()
    }
    await choose(page, /^MD/)
    await dialog(page).getByRole('button', { name: 'Criar dupla' }).click()
    await expect(dialog(page)).toBeHidden()

    await page.getByRole('searchbox', { name: /Buscar dupla/ }).fill(a.name)
    const edit = page.getByRole('button', { name: `Editar dupla ${a.name} e ${b.name}` })
    await expect(edit).toBeVisible()

    // O filtro padrão mostra só duplas ativas: a desativada sai da lista e volta no filtro "Inativas".
    await page.getByRole('button', { name: `Desativar dupla ${a.name} e ${b.name}` }).click()
    await expect(edit).toBeHidden()
    await page.getByRole('combobox', { name: 'Filtrar por situação' }).selectOption('false')
    await expect(page.getByRole('button', { name: `Reativar dupla ${a.name} e ${b.name}` })).toBeVisible()

    const pairs = await api.get<Paged<PairRow & { athlete1Id: string }>>(`/pairs?search=${encodeURIComponent(a.name)}`)
    const pair = pairs.data.find((p) => p.athlete1Id === a.id)
    expect(pair?.discipline).toBe('MD')
    expect(pair?.active).toBe(false)
  })

  test('dupla com o mesmo atleta nos dois lados é recusada', async ({ page }) => {
    const [a] = await createAthletes(1, { gender: 'M', prefix: 'Solo' })
    if (!a) throw new Error('Atleta não criado.')
    await page.goto('/admin/pairs')
    await page.getByRole('button', { name: 'Nova dupla' }).first().click()
    await dialog(page).getByRole('button', { name: /Atleta 1/ }).click()
    await dialog(page).getByPlaceholder('Buscar atleta...').fill(a.name)
    await dialog(page).getByRole('button', { name: new RegExp(a.name) }).click()
    await dialog(page).getByRole('button', { name: 'Criar dupla' }).click()
    await expect(dialog(page).getByRole('alert')).toHaveText('Selecione os dois atletas.')
  })
})
