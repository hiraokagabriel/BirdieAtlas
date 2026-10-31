import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { completeTournament, createRankingWithRules, prepareTournament, uniqueTag, type Ranking } from '../support/factories.js'

// Rankings e regras de pontos no admin, pela interface: criar ranking, cadastrar e excluir regra,
// vincular um torneio encerrado, recalcular e conferir a classificação.

type RuleList = { id: string; tournamentLevel: string; participationBonus: number }[]

// A página pública /r/[tenantSlug] lista todos os rankings: os criados aqui saem no fim para não
// aparecerem nas asserções do public.spec (por exemplo, pontos repetidos).
const createdRankingIds: string[] = []

test.afterAll(async () => {
  for (const id of createdRankingIds) await apiCall('DELETE', `/rankings/${id}`)
})

async function createRanking(body: Record<string, unknown>): Promise<Ranking> {
  const ranking = await api.post<Ranking>('/rankings', body)
  createdRankingIds.push(ranking.id)
  return ranking
}

test.describe('rankings no admin', () => {
  test('cria um ranking pelo formulário e abre a página dele', async ({ page }) => {
    const name = `Ranking Admin ${uniqueTag()}`
    await page.goto('/admin/rankings')
    await page.getByRole('button', { name: 'Novo ranking' }).click()

    await page.getByRole('textbox', { name: /^Nome/ }).fill(name)
    await page.getByLabel('Descrição').fill('Criado pelo teste E2E')
    await page.getByLabel('Mínimo de torneios').fill('1')
    await page.getByRole('button', { name: 'Criar ranking' }).click()

    const card = page.getByRole('link', { name: new RegExp(name) })
    await expect(card).toBeVisible()
    await expect(card).toContainText('Mín. 1')
    await card.click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    createdRankingIds.push(page.url().split('/').pop() ?? '')
    await expect(page.getByText('Nenhuma entrada ainda.')).toBeVisible()
  })

  test('cadastra uma regra de pontos e depois a exclui', async ({ page }) => {
    const tag = uniqueTag()
    const ranking = await createRanking({
      name: `Ranking Regras ${tag}`,
      slug: `ranking-regras-${tag}`,
      discipline: 'MS',
      year: 2031,
      minTournamentsRequired: 0,
    })

    await page.goto(`/admin/rankings/${ranking.id}`)
    await page.getByRole('tab', { name: 'Regras de Pontos' }).click()
    await expect(page.getByText('Nenhuma regra cadastrada ainda.')).toBeVisible()

    await page.getByRole('button', { name: 'Nova Regra' }).click()
    const form = page.getByRole('group', { name: 'Nova Regra' })
    await form.getByLabel('Bônus de Participação').fill('7')
    await form.getByLabel('Categoria (opcional)').fill('Open')
    await form.getByRole('button', { name: 'Salvar Regra' }).click()

    await expect(page.getByText('1 regra(s)')).toBeVisible()
    const rules = await api.get<RuleList>(`/rankings/${ranking.id}/point-rules`)
    expect(rules).toHaveLength(1)
    expect(rules[0]?.tournamentLevel).toBe('state')
    expect(rules[0]?.participationBonus).toBe(7)

    await page.getByRole('button', { name: 'Excluir regra (todas as disciplinas, Open)' }).click()
    await expect(page.getByText('Nenhuma regra cadastrada ainda.')).toBeVisible()
    const after = await api.get<RuleList>(`/rankings/${ranking.id}/point-rules`)
    expect(after).toHaveLength(0)
  })

  test('vincula um torneio encerrado, recalcula e mostra o campeão na classificação', async ({ page }) => {
    const tag = uniqueTag()
    const prepared = await prepareTournament({ athleteCount: 4, level: 'international', name: `Torneio Rank ${tag}` })
    await completeTournament(prepared)
    // award-points exige algum ranking com regra para o nível e liga o torneio a todos que tenham regra. Nível
    // internacional: nenhum outro spec usa regra desse nível, então o ranking público não é afetado.
    createdRankingIds.push((await createRankingWithRules({ year: 2034, level: 'international' })).id)
    // Pontos distribuídos antes de o ranking existir: o torneio fica disponível para vincular à mão.
    await api.post(`/tournaments/${prepared.tournament.id}/award-points`)
    const champion = prepared.athletes[0]
    if (!champion) throw new Error('Sem atletas no torneio de teste.')

    const ranking = await createRanking({
      name: `Ranking Vinculo ${tag}`,
      slug: `ranking-vinculo-${tag}`,
      discipline: 'MS',
      year: 2032,
      minTournamentsRequired: 0,
    })
    await api.post(`/rankings/${ranking.id}/point-rules`, {
      tournamentLevel: 'international',
      multiplier: 1,
      participationBonus: 5,
      entries: [{ placement: 1, basePoints: 100 }, { placement: 2, basePoints: 70 }],
    })

    await page.goto(`/admin/rankings/${ranking.id}`)
    await page.getByRole('tab', { name: /^Torneios/ }).click()
    await page.getByRole('button', { name: `Vincular ${prepared.tournament.name}` }).click()
    await expect(page.getByRole('button', { name: `Desvincular ${prepared.tournament.name}` })).toBeVisible()

    await page.getByRole('button', { name: 'Recalcular' }).click()
    await page.getByRole('tab', { name: /^Classificação/ }).click()
    const table = page.getByRole('region', { name: 'Classificação do ranking' })
    await expect(table).toBeVisible()
    await expect(table.getByRole('row')).toHaveCount(5) // cabeçalho + 4 atletas

    const entries = await api.get<{ data: { position: number; athleteId: string }[] }>(`/rankings/${ranking.id}/entries`)
    expect(entries.data).toHaveLength(4)
    // Os dois semifinalistas eliminados empatam em pontos; o desempate dá posições distintas e estáveis.
    expect(entries.data.map((e) => e.position)).toEqual([1, 2, 3, 4])
    await api.post(`/rankings/${ranking.id}/recalculate`)
    const again = await api.get<{ data: { athleteId: string }[] }>(`/rankings/${ranking.id}/entries`)
    expect(again.data.map((e) => e.athleteId)).toEqual(entries.data.map((e) => e.athleteId))

    await page.getByRole('tab', { name: /^Torneios/ }).click()
    await page.getByRole('button', { name: `Desvincular ${prepared.tournament.name}` }).click()
    await expect(page.getByRole('button', { name: `Vincular ${prepared.tournament.name}` })).toBeVisible()
  })

  test('edita o ranking pelo diálogo Editar', async ({ page }) => {
    const tag = uniqueTag()
    const ranking = await createRanking({
      name: `Ranking Edicao ${tag}`,
      slug: `ranking-edicao-${tag}`,
      discipline: 'WS',
      year: 2033,
      minTournamentsRequired: 0,
    })
    await page.goto(`/admin/rankings/${ranking.id}`)
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar Ranking' })
    await dialog.getByLabel('Melhores resultados').fill('3')
    await dialog.getByRole('button', { name: /Salvar/ }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Top 3 torneios')).toBeVisible()
  })
})
