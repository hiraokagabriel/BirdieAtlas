import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import {
  createAthletes, createCategory, createTournament, generateDraw, publishDraw, registerApproved, uniqueTag,
} from '../support/factories.js'

// Todas as chaves publicadas do torneio (/t/[slug]/chaves): só chaves publicadas, em ordem de disciplina,
// uma categoria por página no PDF.

async function tournamentWithBrackets() {
  const tag = uniqueTag()
  const t = await createTournament({ status: 'in_progress', name: `Chaves ${tag}` })
  // Criadas fora da ordem de divulgação: a página ordena por disciplina (SM, SF...).
  const ws = await createCategory(t.id, { name: 'Simples Feminino A', discipline: 'WS' })
  const ms = await createCategory(t.id, { name: 'Simples Masculino A', discipline: 'MS' })
  const hidden = await createCategory(t.id, { name: 'Simples Masculino B', discipline: 'MS' })
  await registerApproved(ws.id, await createAthletes(4, { gender: 'F', prefix: `F ${tag}` }))
  await registerApproved(ms.id, await createAthletes(4, { gender: 'M', prefix: `M ${tag}` }))
  await registerApproved(hidden.id, await createAthletes(2, { gender: 'M', prefix: `H ${tag}` }))
  await publishDraw((await generateDraw(ws.id)).id)
  await publishDraw((await generateDraw(ms.id)).id)
  await generateDraw(hidden.id) // sorteada, não publicada
  return t
}

test('API devolve só as chaves publicadas, em ordem de disciplina; rascunho é 404', async () => {
  const t = await tournamentWithBrackets()
  const brackets = await api.get<{ category: { name: string }; matches: unknown[]; registrations: Record<string, unknown>[] }[]>(`/tournaments/${t.id}/brackets`)
  expect(brackets.map((b) => b.category.name)).toEqual(['Simples Masculino A', 'Simples Feminino A'])
  expect(brackets[0]!.matches.length).toBeGreaterThan(0)
  for (const key of ['email', 'cpf', 'phone', 'birthYear', 'birthDate', 'notes']) {
    expect(Object.keys(brackets[0]!.registrations[0]!)).not.toContain(key)
  }
  const draft = await createTournament({ status: 'draft' })
  expect((await apiCall('GET', `/tournaments/${draft.id}/brackets`)).status).toBe(404)
})

test('página mostra cada chave e o PDF tem uma categoria por página', async ({ page }) => {
  const t = await tournamentWithBrackets()
  await page.goto(`/t/${t.slug}/chaves`)
  await expect(page.getByRole('heading', { level: 1, name: `Chaves · ${t.name}` })).toBeVisible()
  const sections = page.getByRole('region', { name: /^Chave de/ })
  await expect(sections).toHaveCount(2)
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Simples Masculino A', 'Simples Feminino A'])

  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2)
})

test('o link "Todas as chaves em PDF" sai da chave pública', async ({ page }) => {
  const t = await tournamentWithBrackets()
  await page.goto(`/t/${t.slug}`)
  await page.getByRole('link', { name: 'Todas as chaves em PDF' }).click()
  await expect(page).toHaveURL(new RegExp(`/t/${t.slug}/chaves$`))
})

test('formatos variados (8, 32, todos contra todos, grupos): exatamente uma página por categoria', async ({ page }, testInfo) => {
  const tag = uniqueTag()
  const t = await createTournament({ status: 'in_progress', name: `Formatos ${tag}` })
  const specs = [
    { name: 'Simples Masculino A', discipline: 'MS' as const, drawType: 'single_elimination' as const, n: 8, g: 'M' as const },
    { name: 'Simples Masculino B', discipline: 'MS' as const, drawType: 'single_elimination' as const, n: 32, g: 'M' as const },
    { name: 'Simples Feminino A', discipline: 'WS' as const, drawType: 'round_robin' as const, n: 5, g: 'F' as const },
    { name: 'Simples Feminino B', discipline: 'WS' as const, drawType: 'group_then_elimination' as const, n: 12, g: 'F' as const },
  ]
  for (const s of specs) {
    const cat = await createCategory(t.id, { name: s.name, discipline: s.discipline, drawType: s.drawType })
    await registerApproved(cat.id, await createAthletes(s.n, { gender: s.g, prefix: `${s.g}${s.n} ${tag}` }))
    await publishDraw((await generateDraw(cat.id)).id)
  }
  await page.goto(`/t/${t.slug}/chaves`)
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(4)
  await expect(page.getByText('Carregando classificação...')).toHaveCount(0)
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  const pdf = await page.pdf({ path: testInfo.outputPath('chaves.pdf'), preferCSSPageSize: true, printBackground: true })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(4)
})
