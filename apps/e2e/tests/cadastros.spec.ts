import { expect, test } from '@playwright/test'
import { api } from '../support/api.js'
import { createAthlete, createClub, uniqueTag } from '../support/factories.js'

// Cadastros no admin pela interface: atletas, importação de CSV, clubes e duplas.
// Cada teste usa nomes com sufixo único e confere o resultado na API.

interface Page<T> {
  data: T[]
}

test.describe('atletas', () => {
  test('cria um atleta pelo diálogo e ele aparece na lista e na API', async ({ page }) => {
    const name = `Rafael Cadastro ${uniqueTag()}`
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Novo atleta' }).click()

    const dialog = page.getByRole('dialog', { name: 'Novo atleta' })
    await dialog.getByText('Feminino', { exact: true }).click()
    await dialog.getByLabel('Nome completo').fill(name)
    await dialog.getByRole('button', { name: 'Criar atleta' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('searchbox', { name: 'Buscar atletas por nome ou e-mail' }).fill(name)
    await expect(page.getByRole('button', { name })).toBeVisible()

    const found = await api.get<Page<{ name: string; gender: string }>>(`/athletes?search=${encodeURIComponent(name)}`)
    expect(found.data).toHaveLength(1)
    expect(found.data[0]?.gender).toBe('F')
  })

  test('nome vazio mostra o erro do campo e não cria', async ({ page }) => {
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Novo atleta' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo atleta' })
    await dialog.getByRole('button', { name: 'Criar atleta' }).click()
    await expect(dialog.getByText(/obrigatório/i).first()).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('a busca filtra a lista por nome', async ({ page }) => {
    const athlete = await createAthlete({ name: `Busca Unica ${uniqueTag()}` })
    await page.goto('/admin/athletes')
    await page.getByRole('searchbox', { name: 'Buscar atletas por nome ou e-mail' }).fill(athlete.name)
    await expect(page.getByRole('button', { name: athlete.name })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Buscar atletas por nome ou e-mail' }).fill(`inexistente-${uniqueTag()}`)
    await expect(page.getByRole('button', { name: athlete.name })).toHaveCount(0)
  })
})

test.describe('importação de atletas por CSV', () => {
  test('mostra a prévia, importa as linhas válidas e relata a linha com erro', async ({ page }) => {
    const tag = uniqueTag()
    const csv = [
      'name,gender,birthDate,email,nationality',
      `Importada Um ${tag},F,1995-03-20,,BR`,
      `Importado Dois ${tag},M,,,BR`,
      `Sem Genero ${tag},X,,,BR`,
    ].join('\n')

    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Importar CSV' }).click()
    const dialog = page.getByRole('dialog', { name: 'Importar atletas via CSV' })
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'atletas.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })

    await expect(dialog.getByRole('region', { name: 'Pré-visualização do CSV' })).toBeVisible()
    await expect(dialog.getByText('3 linhas detectadas')).toBeVisible()
    await dialog.getByRole('button', { name: 'Importar 3 atletas' }).click()

    const status = dialog.getByRole('status')
    await expect(status.getByText('2 importados')).toBeVisible()
    await expect(status.getByText('1 com erro')).toBeVisible()
    await expect(status.getByText(/Linha 3/)).toBeVisible()

    const found = await api.get<Page<{ name: string }>>(`/athletes?search=${tag}`)
    expect(found.data).toHaveLength(2)
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
    await expect(dialog).toBeHidden()
  })

  test('o template CSV é baixado pelo diálogo', async ({ page }) => {
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Importar CSV' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Baixar template CSV' }).click()
    expect((await downloadPromise).suggestedFilename()).toBe('template-atletas.csv')
  })
})

test.describe('clubes', () => {
  test('cria um clube com slug derivado do nome e abre a página dele', async ({ page }) => {
    const tag = uniqueTag()
    const name = `Clube Cadastro ${tag}`
    await page.goto('/admin/clubs')
    await page.getByRole('button', { name: 'Novo clube' }).click()

    const dialog = page.getByRole('dialog', { name: 'Novo clube' })
    await dialog.getByLabel('Nome do clube').fill(name)
    await expect(dialog.getByLabel('Slug')).toHaveValue(`clube-cadastro-${tag}`)
    await dialog.getByRole('button', { name: 'Criar clube' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('searchbox', { name: 'Buscar clube' }).fill(name)
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  })

  test('nome e slug obrigatórios; slug inválido é recusado', async ({ page }) => {
    await page.goto('/admin/clubs')
    await page.getByRole('button', { name: 'Novo clube' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo clube' })
    await dialog.getByRole('button', { name: 'Criar clube' }).click()
    await expect(dialog.getByText('Nome é obrigatório')).toBeVisible()
    await expect(dialog.getByText('Slug é obrigatório')).toBeVisible()

    await dialog.getByLabel('Nome do clube').fill('Qualquer')
    await dialog.getByLabel('Slug').fill('Slug Inválido')
    await dialog.getByRole('button', { name: 'Criar clube' }).click()
    await expect(dialog.getByText(/só pode ter letras minúsculas/)).toBeVisible()
  })

  test('edita o nome do clube pela página dele', async ({ page }) => {
    const club = await createClub()
    const renamed = `${club.name} Renomeado`
    await page.goto(`/admin/clubs/${club.id}`)
    await page.getByRole('button', { name: 'Editar clube' }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar clube' })
    await dialog.getByLabel('Nome do clube').fill(renamed)
    await dialog.getByRole('button', { name: /Salvar/ }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible()
  })
})

test.describe('duplas', () => {
  test('cria uma dupla escolhendo dois atletas e desativa', async ({ page }) => {
    const tag = uniqueTag()
    const a1 = await createAthlete({ name: `Dupla Alfa ${tag}`, gender: 'M' })
    const a2 = await createAthlete({ name: `Dupla Beta ${tag}`, gender: 'M' })

    await page.goto('/admin/pairs')
    await page.getByRole('button', { name: 'Nova dupla' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nova dupla' })

    for (const [label, athlete] of [['Atleta 1', a1], ['Atleta 2', a2]] as const) {
      await dialog.getByRole('button', { name: new RegExp(label) }).click()
      await dialog.getByRole('searchbox', { name: new RegExp(`Buscar atleta para ${label}`) }).fill(athlete.name)
      await dialog.getByRole('button', { name: new RegExp(athlete.name) }).click()
    }
    await dialog.getByText('MD', { exact: false }).first().click()
    await dialog.getByRole('button', { name: 'Criar dupla' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('searchbox', { name: 'Buscar dupla por atleta ou clube' }).fill(a1.name)
    const row = page.getByRole('row', { name: new RegExp(a1.name) })
    await expect(row).toBeVisible()

    await page.getByRole('button', { name: `Desativar dupla ${a1.name} e ${a2.name}` }).click()
    await expect(page.getByRole('row', { name: new RegExp(a1.name) })).toHaveCount(0)
  })

  test('uma dupla não aceita o mesmo atleta nos dois lados', async ({ page }) => {
    const a1 = await createAthlete({ name: `Solo ${uniqueTag()}`, gender: 'M' })
    await page.goto('/admin/pairs')
    await page.getByRole('button', { name: 'Nova dupla' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nova dupla' })
    await dialog.getByRole('button', { name: /Atleta 1/ }).click()
    await dialog.getByRole('searchbox', { name: /Buscar atleta para Atleta 1/ }).fill(a1.name)
    await dialog.getByRole('button', { name: new RegExp(a1.name) }).click()

    await dialog.getByRole('button', { name: /Atleta 2/ }).click()
    await dialog.getByRole('searchbox', { name: /Buscar atleta para Atleta 2/ }).fill(a1.name)
    await expect(dialog.getByText('Nenhum atleta encontrado')).toBeVisible()
  })
})
