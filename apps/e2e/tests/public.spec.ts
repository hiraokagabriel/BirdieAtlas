import { expect, test, type Page } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { API_URL, TENANT_SLUG } from '../support/env.js'
import {
  affiliate,
  createAthlete,
  createClub,
  createRankingWithRules,
  finalizeTournament,
  playWholeDraw,
  prepareTournament,
  uniqueTag,
  type Athlete,
  type Club,
  type PreparedTournament,
  type Ranking,
} from '../support/factories.js'

// Portal público. Os dados vêm de um torneio de simples masculino encerrado, criado pela API em `beforeAll`:
// quatro atletas com nomes acentuados, um clube e pontuação num ranking de ano único (o primeiro da lista).

interface ProfileResponse {
  athlete: Record<string, unknown>
  currentClub: { clubName: string; clubSlug: string } | null
  tournamentHistory: { tournamentId: string; finalPlacement: number | null }[]
  rankingPositions: unknown[]
}

// Ano que cresce a cada execução: o ranking criado por último é sempre o primeiro da lista (ordem por ano decrescente),
// mesmo que o `beforeAll` rode de novo quando o Playwright reinicia o worker após uma falha.
const RANKING_YEAR = 2100 + (Math.floor(Date.now() / 1000) % 1_000_000)

let tag: string
let club: Club
let athletes: Athlete[]
let prepared: PreparedTournament
let ranking: Ranking
let champion: Athlete
let runnerUp: Athlete
let secretEmail: string
let liveTournament: PreparedTournament

function findAthlete(id: string): Athlete {
  const found = athletes.find((a) => a.id === id)
  if (!found) throw new Error(`Atleta ${id} não está no torneio de teste.`)
  return found
}

test.beforeAll(async () => {
  tag = uniqueTag()
  secretEmail = `segredo-${tag}@example.com`
  club = await createClub({ name: `Clube Público ${tag}` })

  athletes = [
    await createAthlete({ name: `José Ávila ${tag}`, email: secretEmail, birthDate: '1990-05-17' }),
    await createAthlete({ name: `André Cândido ${tag}` }),
    await createAthlete({ name: `Hélio Nóbrega ${tag}` }),
    await createAthlete({ name: `Álvaro Gonçalves ${tag}` }),
  ]
  for (const athlete of athletes) await affiliate(athlete.id, club.id)

  ranking = await createRankingWithRules({ year: RANKING_YEAR })
  prepared = await prepareTournament({
    athletes,
    name: `Open Público ${tag}`,
    // O fim mais distante coloca o torneio no topo de "Resultados recentes".
    startDate: '2099-12-29',
    endDate: '2099-12-31',
  })
  await playWholeDraw(prepared.draw.id)
  const report = await finalizeTournament(prepared.tournament.id)
  await api.post(`/tournaments/${prepared.tournament.id}/award-points`)

  const podium = report.report[0]?.podium ?? []
  champion = findAthlete(podium.find((p) => p.placement === 1)?.athleteId ?? '')
  runnerUp = findAthlete(podium.find((p) => p.placement === 2)?.athleteId ?? '')

  // Torneio em andamento com data bem antiga: aparece primeiro em "Próximos torneios".
  liveTournament = await prepareTournament({ name: `Em Andamento ${tag}`, startDate: '1999-01-01', endDate: '1999-01-03' })
})

test.describe('home', () => {
  test('carrega os três blocos com dados reais da API', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Todo o badminton das federações/)

    const upcoming = page.getByRole('region', { name: 'Próximos torneios' })
    await expect(upcoming.getByRole('link', { name: new RegExp(liveTournament.tournament.name) })).toBeVisible()
    await expect(upcoming.getByText('Em andamento').first()).toBeVisible()

    const recent = page.getByRole('region', { name: 'Resultados recentes' })
    const recentCard = recent.getByRole('link', { name: new RegExp(prepared.tournament.name) })
    await expect(recentCard).toBeVisible()
    await expect(recentCard).toHaveAttribute('href', `/t/${prepared.tournament.slug}`)
    await expect(recentCard.getByText('Encerrado')).toBeVisible()

    const top10 = page.getByRole('region', { name: 'Top 10 dos rankings' })
    await expect(top10.getByRole('tablist', { name: 'Rankings' })).toBeVisible()
    await expect(top10.getByRole('tab', { name: new RegExp(`Simples masculino ${RANKING_YEAR}`) })).toBeVisible()

    // Nenhum estado de erro nem esqueleto de carregamento sobrando.
    // (o anunciador de rotas do Next também é role=alert, mas vazio)
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0)
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  })

  test('card de resultado recente leva ao torneio', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('region', { name: 'Resultados recentes' })
      .getByRole('link', { name: new RegExp(prepared.tournament.name) })
      .click()
    await expect(page).toHaveURL(new RegExp(`/t/${prepared.tournament.slug}$`))
    await expect(page.getByRole('heading', { level: 1, name: prepared.tournament.name })).toBeVisible()
  })

  test('top 10: abas pelo teclado e classificação do ranking', async ({ page }) => {
    await page.goto('/')
    const top10 = page.getByRole('region', { name: 'Top 10 dos rankings' })
    const tabs = top10.getByRole('tab')
    await expect(tabs.first()).toBeVisible()
    const count = await tabs.count()
    expect(count).toBeGreaterThan(1)

    // Só a aba selecionada entra na ordem de Tab (roving tabindex).
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
    await expect(tabs.first()).toHaveAttribute('tabindex', '0')
    await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1')

    await tabs.first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(1)).toBeFocused()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'false')

    await page.keyboard.press('End')
    await expect(tabs.nth(count - 1)).toBeFocused()
    await expect(tabs.nth(count - 1)).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('ArrowRight') // dá a volta para a primeira
    await expect(tabs.first()).toBeFocused()
    await page.keyboard.press('ArrowLeft') // e volta para a última
    await expect(tabs.nth(count - 1)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(tabs.first()).toBeFocused()

    // A aba do ranking do teste mostra o campeão com os pontos (100 do 1º lugar + 5 de participação).
    await top10.getByRole('tab', { name: new RegExp(`Simples masculino ${RANKING_YEAR}`) }).click()
    const panel = top10.getByRole('tabpanel')
    const rows = panel.getByRole('listitem')
    await expect(rows.first()).toContainText(champion.name)
    await expect(rows.first()).toContainText('105')
    await expect(rows.first().getByText('1º lugar')).toBeAttached()
    await expect(rows).toHaveCount(4)
    await expect(panel.getByRole('link', { name: 'Ver ranking completo' })).toHaveAttribute('href', `/r/${TENANT_SLUG}`)
  })
})

test.describe('busca de atletas', () => {
  async function search(page: Page, query: string): Promise<void> {
    await page.goto('/')
    await page.getByRole('searchbox', { name: 'Buscar atletas e clubes' }).fill(query)
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page).toHaveURL(/\/\?q=/)
  }

  test('acha o atleta ignorando acento e caixa, sem expor dados pessoais', async ({ page }) => {
    await search(page, `jose avila ${tag.toUpperCase()}`)

    const results = page.getByRole('region', { name: /Resultados para/ })
    const hit = results.getByRole('link', { name: new RegExp(`José Ávila ${tag}`) })
    await expect(hit).toBeVisible()
    await expect(hit).toContainText(club.name)

    // E-mail e data de nascimento nunca chegam ao HTML público.
    await expect(page.locator('body')).not.toContainText(secretEmail)
    await expect(page.locator('body')).not.toContainText('1990')

    await hit.click()
    await expect(page).toHaveURL(new RegExp(`/a/${athletes[0]?.id}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`José Ávila ${tag}`)
  })

  test('busca por nome de clube mostra o clube', async ({ page }) => {
    await search(page, club.name)
    const results = page.getByRole('region', { name: /Resultados para/ })
    await expect(results.getByRole('heading', { name: 'Clubes' })).toBeVisible()
    await expect(results.getByRole('link', { name: new RegExp(club.name) })).toHaveAttribute('href', `/c/${club.slug}`)
  })

  test('sem resultado mostra o aviso de vazio', async ({ page }) => {
    await search(page, `zzqx-inexistente-${tag}`)
    await expect(page.getByText(/Nada encontrado para/)).toBeVisible()
  })

  test('consulta curta pede mais letras (sem chamar a API com erro)', async ({ page }) => {
    await search(page, 'a')
    await expect(page.getByText('Digite pelo menos 2 letras para buscar.')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0)
  })

  test('a API pública recusa consulta curta e não devolve dados pessoais', async () => {
    const short = await apiCall<{ code: string }>('GET', '/athletes/search?q=a')
    expect(short.status).toBe(400)
    expect(short.body.code).toBe('VALIDATION_ERROR')

    const ok = await apiCall<{ data: Record<string, unknown>[] }>('GET', `/athletes/search?q=${encodeURIComponent(`José Ávila ${tag}`)}`)
    expect(ok.status).toBe(200)
    expect(ok.body.data).toHaveLength(1)
    const hit = ok.body.data[0] ?? {}
    expect(Object.keys(hit)).not.toEqual(expect.arrayContaining(['email']))
    expect(JSON.stringify(ok.body)).not.toContain(secretEmail)
    expect(JSON.stringify(ok.body)).not.toContain('1990-05-17')
  })
})

test.describe('perfil do atleta', () => {
  test('pódio e histórico batem com a API pública', async ({ page }) => {
    const profile = await api.get<ProfileResponse>(`/athletes/${champion.id}/profile`)
    const history = profile.tournamentHistory
    const expectedTitles = history.filter((h) => h.finalPlacement === 1).length
    const expectedPodiums = history.filter((h) => h.finalPlacement !== null && h.finalPlacement <= 3).length
    const expectedTournaments = new Set(history.map((h) => h.tournamentId)).size
    // Sanidade do fixture: o campeão tem um título neste torneio.
    expect(expectedTitles).toBe(1)

    await page.goto(`/a/${champion.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(champion.name)

    const stat = (label: string) => page.getByRole('term').filter({ hasText: label }).locator('..').getByRole('definition')
    await expect(stat('Títulos')).toHaveText(String(expectedTitles))
    await expect(stat('Pódios')).toHaveText(String(expectedPodiums))
    await expect(stat('Torneios disputados')).toHaveText(String(expectedTournaments))

    const historyList = page.getByRole('region', { name: 'Histórico de torneios' })
    const entry = historyList.getByRole('listitem').filter({ hasText: prepared.tournament.name })
    await expect(entry.getByText('1º lugar')).toBeAttached()
    await expect(entry.getByRole('link', { name: prepared.tournament.name })).toHaveAttribute('href', `/t/${prepared.tournament.slug}`)

    // Clube atual e ranking.
    await expect(page.getByRole('link', { name: club.name })).toHaveAttribute('href', `/c/${club.slug}`)
    const rankings = page.getByRole('region', { name: 'Rankings' })
    await expect(rankings).toContainText(ranking.name)
    await expect(rankings).toContainText('105')
  })

  test('o vice tem pódio e o título fica só com o campeão', async ({ page }) => {
    await page.goto(`/a/${runnerUp.id}`)
    const stat = (label: string) => page.getByRole('term').filter({ hasText: label }).locator('..').getByRole('definition')
    await expect(stat('Títulos')).toHaveText('0')
    await expect(stat('Pódios')).toHaveText('1')
    await expect(page.getByRole('region', { name: 'Histórico de torneios' }).getByText('2º lugar')).toBeAttached()
  })

  test('a página e a API pública não expõem e-mail nem nascimento', async ({ page }) => {
    const owner = athletes[0]
    if (!owner) throw new Error('fixture sem atletas')
    await page.goto(`/a/${owner.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(owner.name)
    await expect(page.locator('body')).not.toContainText(secretEmail)
    const json = JSON.stringify(await api.get(`/athletes/${owner.id}/profile`))
    expect(json).not.toContain(secretEmail)
    expect(json).not.toContain('1990-05-17')
    expect(json).not.toContain('birthDate')
  })

  test('atleta inexistente mostra a página 404', async ({ page }) => {
    const response = await page.goto('/a/00000000-0000-4000-8000-000000000000')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1, name: 'Atleta não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar para o início' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('id malformado também cai na página 404', async ({ page }) => {
    const response = await page.goto('/a/isto-nao-e-um-id')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1, name: 'Atleta não encontrado' })).toBeVisible()
  })
})

test.describe('torneio público encerrado', () => {
  test('mostra a chave visual e o destaque do campeão', async ({ page }) => {
    await page.goto(`/t/${prepared.tournament.slug}`)
    await expect(page.getByRole('heading', { level: 1, name: prepared.tournament.name })).toBeVisible()
    await expect(page.getByText('Encerrado', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('3 / 3 (100%)')).toBeVisible()

    const bracket = page.getByRole('region', { name: 'Chave de Simples Masculino' })
    await expect(bracket).toBeVisible()
    await expect(bracket.getByRole('region', { name: 'Semifinal', exact: true })).toBeVisible()
    await expect(bracket.getByRole('region', { name: 'Final', exact: true })).toBeVisible()
    // 2 semifinais + final.
    await expect(bracket.getByRole('group')).toHaveCount(3)

    const final = bracket.getByRole('group', { name: new RegExp(`^Final, partida 1: .*vencedor ${champion.name}$`) })
    await expect(final).toBeVisible()
    await expect(final.getByText('Finalizada')).toBeVisible()
    await expect(final.getByText('Campeão')).toBeAttached()

    // Destaque do campeão, com vice e link para o perfil.
    const callout = page.getByText(/^Vice:/).locator('..')
    await expect(callout.getByText('Campeão', { exact: true })).toBeVisible()
    await expect(callout.getByRole('link', { name: champion.name })).toHaveAttribute('href', `/a/${champion.id}`)
    await expect(callout).toContainText(`Vice: ${runnerUp.name}`)
  })

  test('a lista de inscritos e o controle de impressão estão disponíveis', async ({ page }) => {
    await page.goto(`/t/${prepared.tournament.slug}`)
    await expect(page.getByRole('button', { name: 'Imprimir / Salvar PDF' })).toBeVisible()

    await page.getByRole('button', { name: /Inscritos/ }).click()
    for (const athlete of athletes) await expect(page.getByText(athlete.name)).toBeVisible()
    await expect(page.getByText('Confirmados (4)')).toBeVisible()
  })

  test('torneio inexistente mostra a mensagem de não encontrado', async ({ page }) => {
    await page.goto('/t/torneio-que-nao-existe')
    await expect(page.getByRole('heading', { name: 'Torneio não encontrado' })).toBeVisible()
  })

  test('torneio em andamento mostra "Ao vivo agora" sem partidas', async ({ page }) => {
    await page.goto(`/t/${liveTournament.tournament.slug}`)
    const live = page.getByRole('region', { name: 'Ao vivo agora' })
    await expect(live).toBeVisible()
    await expect(live.getByText('Nenhuma partida ao vivo no momento.')).toBeVisible()
  })
})

test.describe('ranking público', () => {
  test('lista a classificação e oferece o CSV pela API', async ({ page, request }) => {
    await page.goto(`/r/${TENANT_SLUG}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Ranking' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Simples Masc.' }).first()).toBeVisible()

    const row = page.getByRole('link', { name: champion.name })
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('href', `/a/${champion.id}`)
    await expect(page.getByText('105', { exact: true })).toBeVisible()

    // CSV público: UTF-8 com BOM, separador `;`, cabeçalhos do contrato e nome do arquivo em slug.
    const csv = await request.get(`${API_URL}/rankings/${ranking.id}/entries/export.csv`)
    expect(csv.status()).toBe(200)
    expect(csv.headers()['content-type']).toContain('text/csv')
    expect(csv.headers()['content-disposition']).toMatch(/attachment; filename="[a-z0-9-]+\.csv"/)
    const bytes = await csv.body()
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = bytes.subarray(3).toString('utf-8')
    const lines = text.trim().split('\r\n')
    expect(lines[0]).toBe('Posição;Atleta;Parceiro(a);Pontos;Torneios')
    expect(lines[1]).toContain(`1;${champion.name};`)
    expect(text).not.toContain(secretEmail)
    expect(lines).toHaveLength(5)
  })

  test('o admin baixa o CSV do ranking pelo botão "Exportar CSV"', async ({ page, request }) => {
    await page.goto(`/admin/rankings/${ranking.id}`)
    await expect(page.getByRole('heading', { name: ranking.name })).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)

    const apiCsv = await request.get(`${API_URL}/rankings/${ranking.id}/entries/export.csv`)
    const expected = (await apiCsv.body()).toString('utf-8')
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array))
    expect(Buffer.concat(chunks).toString('utf-8')).toBe(expected)
  })

  test('CSV de ranking inexistente responde 404', async ({ request }) => {
    const res = await request.get(`${API_URL}/rankings/nao-existe/entries/export.csv`)
    expect(res.status()).toBe(404)
  })

  test.fixme(
    'a página pública do ranking tem um link para baixar o CSV',
    // Hoje o CSV só existe na API pública e no botão do admin; a página /r/[tenantSlug] não o oferece.
    async ({ page }) => {
      await page.goto(`/r/${TENANT_SLUG}`)
      await expect(page.getByRole('link', { name: /CSV/ })).toBeVisible()
    },
  )
})

test.describe('compartilhar', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('sem Web Share API, copia o link e confirma com toast e região aria-live', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    })
    await page.goto(`/t/${prepared.tournament.slug}`)
    await page.getByRole('button', { name: 'Compartilhar' }).click()

    const status = page.getByRole('main').getByRole('status')
    await expect(status).toHaveText('Link copiado para a área de transferência.')
    await expect(page.getByText('Link copiado', { exact: true })).toBeVisible()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(page.url())
  })

  test('com Web Share API, usa o compartilhamento nativo', async ({ page }) => {
    await page.addInitScript(() => {
      const shared: unknown[] = []
      Object.defineProperty(window, '__shared', { value: shared })
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
      Object.defineProperty(navigator, 'share', {
        value: (data: unknown) => {
          shared.push(data)
          return Promise.resolve()
        },
        configurable: true,
      })
    })
    await page.goto(`/a/${champion.id}`)
    await page.getByRole('button', { name: 'Compartilhar' }).click()
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Compartilhado.')
    const shared = await page.evaluate(() => Reflect.get(window, '__shared') as { url: string; title: string }[])
    expect(shared).toHaveLength(1)
    expect(shared[0]?.url).toBe(page.url())
    expect(shared[0]?.title).toContain(champion.name)
  })

  test('quando nem copiar funciona, avisa o erro', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('negado')) },
        configurable: true,
      })
    })
    await page.goto(`/r/${TENANT_SLUG}`)
    await page.getByRole('button', { name: 'Compartilhar' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('Não foi possível copiar o link.')
  })

  test('os links "Baixar imagem" apontam para o PNG de compartilhamento', async ({ page, request }) => {
    await page.goto(`/t/${prepared.tournament.slug}`)
    const link = page.getByRole('link', { name: 'Baixar imagem', exact: true })
    const href = await link.getAttribute('href')
    expect(href).toContain(`/t/${prepared.tournament.slug}/share-image`)
    const res = await request.get(new URL(href ?? '', page.url()).toString())
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
    expect(res.headers()['content-disposition']).toContain('attachment')
    await expect(page.getByRole('link', { name: 'Baixar imagem (story)' })).toBeVisible()
  })
})
