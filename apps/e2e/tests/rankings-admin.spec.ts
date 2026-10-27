import { expect, test } from '@playwright/test'
import { api } from '../support/api.js'
import { completeTournament, createRankingWithRules, prepareTournament, uniqueTag } from '../support/factories.js'

// Rankings e regras de pontos no painel admin: criar o ranking, cadastrar regra, vincular um torneio
// encerrado, recalcular e conferir a classificação. Estado final conferido pela API.

interface RankingRow {
  id: string
  name: string
  slug: string
  discipline: string
  year: number
}

interface PointRule {
  id: string
  tournamentLevel: string
  multiplier: number
  participationBonus: number
  entries: { placement: number; basePoints: number }[]
}

interface Entries {
  data: { athleteId: string; position: number; totalPoints: number }[]
}

// Ano único por execução, longe dos anos usados pelos outros specs (que crescem a cada execução).
const YEAR = 2040 + (Date.now() % 50)

test.describe.configure({ mode: 'serial' })

test('cria um ranking pelo formulário e o abre', async ({ page }) => {
  const name = `Ranking Admin ${uniqueTag()}`
  await page.goto('/admin/rankings')
  await page.getByRole('button', { name: 'Novo ranking' }).click()
  await page.getByLabel(/^Nome/).fill(name)
  await page.getByLabel(/^Ano/).fill(String(YEAR))
  await page.getByRole('button', { name: 'Criar ranking' }).click()

  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  const created = (await api.get<{ data: RankingRow[] }>('/rankings?tenantSlug=fpb-sp')).data.find((r) => r.name === name)
  expect(created?.year).toBe(YEAR)
  expect(created?.discipline).toBe('MS')

  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
})

test('nome repetido mostra o erro da API sem criar outro ranking', async ({ page }) => {
  const existing = await createRankingWithRules({ year: YEAR + 100 })
  await page.goto('/admin/rankings')
  await page.getByRole('button', { name: 'Novo ranking' }).click()
  await page.getByLabel(/^Nome/).fill(existing.name)
  await page.getByRole('button', { name: 'Criar ranking' }).click()
  await expect(page.getByText('Erro ao criar ranking', { exact: true })).toBeVisible()
})

test('cadastra, edita e exclui uma regra de pontos', async ({ page }) => {
  const ranking = await api.post<RankingRow>('/rankings', {
    name: `Ranking Regras ${uniqueTag()}`,
    slug: `ranking-regras-${uniqueTag()}`,
    discipline: 'MS',
    year: YEAR + 1,
    minTournamentsRequired: 0,
  })
  await page.goto(`/admin/rankings/${ranking.id}`)
  await page.getByRole('tab', { name: 'Regras de Pontos' }).click()

  await page.getByRole('button', { name: 'Nova Regra' }).click()
  const form = page.getByRole('group', { name: 'Nova Regra' })
  await form.getByLabel('Bônus de Participação').fill('7')
  await form.getByLabel('Pontos base do 1º lugar').fill('120')
  await form.getByRole('button', { name: 'Salvar Regra' }).click()
  await expect(form).toBeHidden()

  let rules = await api.get<PointRule[]>(`/rankings/${ranking.id}/point-rules`)
  expect(rules).toHaveLength(1)
  expect(rules[0]?.participationBonus).toBe(7)
  expect(rules[0]?.entries.find((e) => e.placement === 1)?.basePoints).toBe(120)

  await page.getByRole('button', { name: /^Editar regra/ }).click()
  const edit = page.getByRole('group', { name: 'Editar Regra' })
  await edit.getByLabel('Bônus de Participação').fill('11')
  await edit.getByRole('button', { name: 'Salvar Regra' }).click()
  await expect(edit).toBeHidden()
  rules = await api.get<PointRule[]>(`/rankings/${ranking.id}/point-rules`)
  expect(rules[0]?.participationBonus).toBe(11)

  await page.getByRole('button', { name: /^Excluir regra/ }).click()
  await expect(page.getByRole('button', { name: /^Excluir regra/ })).toBeHidden()
  expect(await api.get<PointRule[]>(`/rankings/${ranking.id}/point-rules`)).toHaveLength(0)
})

test('vincula um torneio encerrado, recalcula e mostra a classificação', async ({ page }) => {
  // Nível "international": nenhum outro spec usa, então distribuir os pontos não vincula este torneio a rankings alheios
  // (nem recalcula o ranking de outro spec que roda em paralelo).
  const ranking = await createRankingWithRules({ year: YEAR + 2, level: 'international' })
  const prepared = await prepareTournament({ name: `Torneio do ranking ${uniqueTag()}`, level: 'international' })
  const report = await completeTournament(prepared)
  // Distribuir os pontos vincula o torneio aos rankings com regra para o nível dele (e só então ele pode ser vinculado à mão).
  await api.post(`/tournaments/${prepared.tournament.id}/award-points`)
  const championId = report.report[0]?.podium.find((p) => p.placement === 1)?.athleteId
  const champion = prepared.athletes.find((a) => a.id === championId)
  if (!champion) throw new Error('O encerramento não devolveu o campeão.')

  await page.goto(`/admin/rankings/${ranking.id}`)
  await page.getByRole('tab', { name: /^Torneios/ }).click()
  // Os pontos distribuídos já vincularam o torneio: desvincula e vincula de novo pela tela.
  const unlink = page.getByRole('button', { name: `Desvincular ${prepared.tournament.name}` })
  await expect(unlink).toBeVisible()
  await unlink.click()
  const link = page.getByRole('button', { name: `Vincular ${prepared.tournament.name}` })
  await expect(link).toBeVisible()
  await link.click()
  await expect(unlink).toBeVisible()

  await page.getByRole('button', { name: 'Recalcular' }).click()
  await page.getByRole('tab', { name: /^Classificação/ }).click()
  await expect(page.getByRole('region', { name: 'Classificação do ranking' })).toContainText(champion.name)

  const entries = await api.get<Entries>(`/rankings/${ranking.id}/entries`)
  const top = entries.data.find((e) => e.athleteId === champion.id)
  // Campeão: 100 pontos do 1º lugar + 5 de participação (regra de `createRankingWithRules`).
  expect(top?.totalPoints).toBe(105)
  expect(top?.position).toBe(1)
})
