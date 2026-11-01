import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { settle, THEMES, useTheme } from '../support/wcag-page.js'
import { affiliate, createAthlete, createClub, uniqueTag } from '../support/factories.js'

// Importação de torneio por planilha: API (validação, resolução de atletas e clubes, gravação) e tela
// (modelo para baixar, leitura de .xlsx e .csv, relatório de erros).

interface Report {
  ok: boolean
  dryRun: boolean
  errors: { sheet: string; row: number; field: string; message: string }[]
  warnings: { message: string }[]
  summary: {
    tournament: { name: string; slug: string; kind: string }
    categories: number
    registrations: number
    athletes: { existing: number; created: number }
    clubs: { existing: number; created: number }
    pairs: { existing: number; created: number }
  }
  tournamentId?: string
}

const tournament = (name: string, extra: Record<string, string> = {}) => ({ name, startDate: '15/11/2099', endDate: '17/11/2099', ...extra })

function payload(tag: string, dryRun: boolean) {
  return {
    dryRun,
    tournament: tournament(`Importado ${tag}`, { kind: 'Amistoso', city: 'Campinas', state: 'sp' }),
    categories: [
      { row: 2, name: 'Simples A', discipline: 'Simples Masculino', drawType: 'Suíço', maxEntries: '8' },
      { row: 3, name: 'Duplas F', discipline: 'Duplas Femininas', drawType: 'Grupos + eliminatória' },
    ],
    entries: [
      { row: 2, category: 'Simples A', athlete: `Novo ${tag} Um`, gender: 'M', club: `Clube Novo ${tag}`, seed: '1' },
      { row: 3, category: 'Simples A', athlete: `Novo ${tag} Dois`, gender: 'M', club: `Clube Novo ${tag}`, status: 'Pendente' },
      { row: 4, category: 'Duplas F', athlete: `Nova ${tag} Ana`, partner: `Nova ${tag} Bia`, gender: 'F', partnerGender: 'F', club: `Clube Novo ${tag}` },
    ],
  }
}

test.describe('importar torneio (API)', () => {
  test('verificar não grava nada e conta o que seria criado', async () => {
    const tag = uniqueTag()
    const res = await apiCall<Report>('POST', '/import/tournament', payload(tag, true))
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, dryRun: true, errors: [] })
    expect(res.body.summary).toMatchObject({
      categories: 2,
      registrations: 3,
      athletes: { created: 4, existing: 0 },
      clubs: { created: 1 },
      pairs: { created: 1, existing: 0 },
      tournament: { kind: 'friendly', slug: `importado-${tag}` },
    })
    expect((await apiCall('GET', `/tournaments/by-slug/importado-${tag}`)).status).toBe(404)
  })

  test('importar cria torneio amistoso, categorias, atletas, clube, dupla e inscrições', async () => {
    const tag = uniqueTag()
    const res = await apiCall<Report>('POST', '/import/tournament', payload(tag, false))
    expect(res.status).toBe(201)
    const id = res.body.tournamentId!

    const t = await api.get<{ kind: string; status: string; state: string; city: string }>(`/tournaments/${id}`)
    expect(t).toMatchObject({ kind: 'friendly', status: 'draft', state: 'SP', city: 'Campinas' })

    const categories = await api.get<{ name: string; discipline: string; drawType: string; maxEntries: number | null }[]>(`/tournaments/${id}/categories`)
    expect(categories.map((c) => [c.name, c.discipline, c.drawType, c.maxEntries]).sort()).toEqual([
      ['Duplas F', 'WD', 'group_then_elimination', null],
      ['Simples A', 'MS', 'swiss', 8],
    ])

    const regs = (await api.get<{ data: { athleteName: string; athlete2Name: string | null; status: string; seed: number | null }[] }>(`/registrations/tournament/${id}`)).data
    expect(regs).toHaveLength(3)
    expect(regs.find((r) => r.athleteName === `Novo ${tag} Um`)).toMatchObject({ status: 'approved', seed: 1 })
    expect(regs.find((r) => r.athleteName === `Novo ${tag} Dois`)?.status).toBe('pending')
    expect(regs.find((r) => r.athlete2Name)).toMatchObject({ athleteName: expect.stringContaining('Ana'), athlete2Name: expect.stringContaining('Bia') })

    const found = await api.get<{ data: { name: string; clubName: string | null }[] }>(`/athletes?search=${encodeURIComponent(`Novo ${tag}`)}`)
    expect(found.data).toHaveLength(2)
    expect(found.data.every((a) => a.clubName === `Clube Novo ${tag}`)).toBe(true)
  })

  test('reconhece atletas e clubes já cadastrados (sem diferenciar acento) e desfaz homônimos pelo clube', async () => {
    const tag = uniqueTag()
    const clubA = await createClub({ name: `Clube Alfa ${tag}` })
    const clubB = await createClub({ name: `Clube Beta ${tag}` })
    const name = `Zélia Homônima ${tag}`
    const a = await createAthlete({ name, gender: 'F' })
    const b = await createAthlete({ name, gender: 'F' })
    await affiliate(a.id, clubA.id)
    await affiliate(b.id, clubB.id)
    const solo = await createAthlete({ name: `Joaquim Único ${tag}`, gender: 'M' })

    const base = {
      dryRun: true,
      tournament: tournament(`Existentes ${tag}`),
      categories: [{ row: 2, name: 'F', discipline: 'WS' }, { row: 3, name: 'M', discipline: 'MS' }],
    }
    const ambiguous = await apiCall<Report>('POST', '/import/tournament', {
      ...base,
      entries: [{ row: 2, category: 'F', athlete: name }, { row: 3, category: 'M', athlete: `JOAQUIM UNICO ${tag}` }],
    })
    expect(ambiguous.body.ok).toBe(false)
    expect(ambiguous.body.errors).toHaveLength(1)
    expect(ambiguous.body.errors[0]).toMatchObject({ sheet: 'Inscritos', row: 2, message: expect.stringContaining('Informe o clube ou o e-mail') })

    const fine = await apiCall<Report>('POST', '/import/tournament', {
      ...base,
      entries: [{ row: 2, category: 'F', athlete: name, club: `clube beta ${tag}` }, { row: 3, category: 'M', athlete: `JOAQUIM UNICO ${tag}` }],
    })
    expect(fine.body).toMatchObject({ ok: true })
    expect(fine.body.summary.athletes).toEqual({ existing: 2, created: 0 })
    expect(fine.body.summary.clubs.created).toBe(0)
    void solo
  })

  test('erros apontam aba, linha e campo; importar de verdade com erro responde 422 e não grava', async () => {
    const tag = uniqueTag()
    const bad = {
      dryRun: false,
      tournament: tournament(`Com Erros ${tag}`),
      categories: [{ row: 2, name: 'Fem', discipline: 'Simples Feminino' }, { row: 3, name: 'Ruim', discipline: 'Veteranos' }],
      entries: [
        { row: 2, category: 'Fem', athlete: `Novo ${tag}` }, // sem sexo: deduzido da categoria (sem erro)
        { row: 3, category: 'Fem', athlete: `Homem ${tag}`, gender: 'M' }, // gênero errado para a disciplina
        { row: 4, category: 'Nenhuma', athlete: 'X', gender: 'M' },
      ],
    }
    const res = await apiCall<{ code: string; details: Report }>('POST', '/import/tournament', bad)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('IMPORT_INVALID')
    const messages = res.body.details.errors.map((e) => `${e.sheet}:${e.row}:${e.field}`)
    expect(messages).toEqual(expect.arrayContaining(['Categorias:3:Disciplina', 'Inscritos:3:Sexo', 'Inscritos:4:Categoria']))
    expect((await apiCall('GET', `/tournaments/by-slug/com-erros-${tag}`)).status).toBe(404)
  })

  test('endereço: gerado com sufixo se já existir; informado e repetido é erro', async () => {
    const tag = uniqueTag()
    const input = { dryRun: false, tournament: tournament(`Mesmo Nome ${tag}`), categories: [{ row: 2, name: 'A', discipline: 'MS' }], entries: [] }
    const first = await apiCall<Report>('POST', '/import/tournament', input)
    const second = await apiCall<Report>('POST', '/import/tournament', input)
    expect(first.body.summary.tournament.slug).toBe(`mesmo-nome-${tag}`)
    expect(second.body.summary.tournament.slug).toBe(`mesmo-nome-${tag}-2`)

    const taken = await apiCall<Report>('POST', '/import/tournament', { ...input, dryRun: true, tournament: tournament('X', { slug: `mesmo-nome-${tag}` }) })
    expect(taken.body.errors.some((e) => e.field === 'Endereço (slug)')).toBe(true)
  })
})

async function openDialog(page: Page) {
  await page.goto('/admin/tournaments')
  await page.getByRole('button', { name: 'Importar planilha' }).click()
  return page.getByRole('dialog', { name: 'Importar torneio por planilha' })
}

test.describe('importar torneio (tela)', () => {
  test('o modelo .xlsx baixado é lido de volta, verificado e importado', async ({ page }) => {
    const dialog = await openDialog(page)
    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Baixar modelo (.xlsx)' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('modelo-torneio.xlsx')
    const file = join(tmpdir(), `modelo-${uniqueTag()}.xlsx`)
    await download.saveAs(file)

    await dialog.locator('input[type="file"]').setInputFiles(file)
    await expect(dialog.getByText(/Lidas 3 categorias e 7 inscrições/)).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: /^Nome/ })).toHaveValue('Aberto de Exemplo')
    await expect(dialog.getByLabel('Início')).toHaveValue('15/11/2026')

    await dialog.getByRole('button', { name: 'Verificar planilha' }).click()
    await expect(dialog.getByText('Planilha válida')).toBeVisible()
    await expect(dialog.getByText('3', { exact: true }).first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Importar torneio' }).click()

    await expect(page).toHaveURL(/\/admin\/tournaments\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: /Aberto de Exemplo/ })).toBeVisible()
  })

  test('CSV com erros mostra a tabela de erros e não oferece importar', async ({ page }) => {
    const tag = uniqueTag()
    const csv = [
      'Categoria;Atleta;Parceiro(a);Sexo;Clube;Disciplina;Formato',
      `Simples A;Fulano ${tag};;M;Clube ${tag};Simples Masculino;Todos contra todos`,
      `Simples A;Beltrano ${tag};;F;;;`, // sexo F em categoria masculina
      `Duplas;Sicrano ${tag};;M;;Duplas Masculinas;`, // dupla sem parceiro
    ].join('\r\n')
    const dialog = await openDialog(page)
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'erros.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') })
    await dialog.getByRole('textbox', { name: /^Nome/ }).fill(`CSV ${tag}`)
    await dialog.getByLabel('Início').fill('15/11/2099')
    await dialog.getByLabel('Término').fill('16/11/2099')
    await dialog.getByRole('button', { name: 'Verificar planilha' }).click()

    const errors = dialog.getByRole('region', { name: 'Erros' })
    await expect(errors).toBeVisible()
    await expect(errors.getByRole('cell', { name: 'Sexo', exact: true })).toBeVisible()
    await expect(errors.getByRole('cell', { name: 'Parceiro(a)', exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Importar torneio' })).toHaveCount(0)
  })

  test('CSV válido (modelo em CSV) cria o torneio', async ({ page }) => {
    const dialog = await openDialog(page)
    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Baixar modelo (.csv)' }).click()
    const download = await downloadPromise
    const file = join(tmpdir(), `modelo-${uniqueTag()}.csv`)
    await download.saveAs(file)

    await dialog.locator('input[type="file"]').setInputFiles(file)
    await dialog.getByRole('textbox', { name: /^Nome/ }).fill(`Via CSV ${uniqueTag()}`)
    await dialog.getByLabel('Início').fill('15/11/2099')
    await dialog.getByLabel('Término').fill('16/11/2099')
    await dialog.getByRole('button', { name: 'Verificar planilha' }).click()
    await expect(dialog.getByText('Planilha válida')).toBeVisible()
    await dialog.getByRole('button', { name: 'Importar torneio' }).click()
    await expect(page).toHaveURL(/\/admin\/tournaments\/[0-9a-f-]{36}$/)
  })

  test('planilha consolidada (Mod/cat., clube no nome) é lida, verificada e importada', async ({ page }) => {
    const tag = uniqueTag()
    const csv = [
      'Mod/cat.;RK;Nome 1;Nome 2;Entidade',
      `SMA;1;Cons Um ${tag} 04 (CLUBE ${tag});;`,
      `SFA;;Cons Dois ${tag} (CLUBE ${tag});;`,
      `DFSB ??;;Cons Tres ${tag} (CLUBE ${tag});Cons Quatro ${tag} (CLUBE ${tag});`,
      `DXB;;Cons Tres ${tag};Cons Um ${tag};CLUBE ${tag}`, // mista: sexo completado pelas outras categorias
      `DF/DX;;Cons Cinco ${tag};Cons Seis ${tag};CLUBE ${tag}`, // ambíguo: ignorada com aviso
    ].join(String.fromCharCode(13, 10))
    const dialog = await openDialog(page)
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'consolidada.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') })
    await expect(dialog.getByText('Planilha consolidada')).toBeVisible()
    await expect(dialog.getByText(/Linhas ignoradas por categoria não reconhecida/)).toBeVisible()
    await dialog.getByLabel('Início').fill('15/11/2099')
    await dialog.getByLabel('Término').fill('16/11/2099')
    await dialog.getByRole('button', { name: 'Verificar planilha' }).click()
    await expect(dialog.getByText('Planilha válida')).toBeVisible()
    await dialog.getByRole('button', { name: 'Importar torneio' }).click()
    await expect(page).toHaveURL(/\/admin\/tournaments\/[0-9a-f-]{36}$/)
  })

  for (const theme of THEMES) {
    test(`diálogo com relatório sem violações de acessibilidade (${theme})`, async ({ page }) => {
      await useTheme(page, theme)
      const dialog = await openDialog(page)
      const csv = 'Categoria;Atleta;Sexo;Disciplina\r\nA;Pessoa Teste;F;Simples Masculino\r\n'
      await dialog.locator('input[type="file"]').setInputFiles({ name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') })
      await dialog.getByRole('textbox', { name: /^Nome/ }).fill('Torneio A11y')
      await dialog.getByLabel('Início').fill('15/11/2099')
      await dialog.getByLabel('Término').fill('16/11/2099')
      await dialog.getByRole('button', { name: 'Verificar planilha' }).click()
      await expect(dialog.getByRole('region', { name: 'Erros' })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `importar planilha [${theme}]`)
    })
  }
})
