import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { WEB_URL } from '../support/env.js'
import {
  listLiveMatches,
  listMatches,
  prepareTournament,
  scheduleMatch,
  scoreUntilDecided,
  type PreparedTournament,
} from '../support/factories.js'

// Placar ao vivo. O operador usa a tela `/admin/live` num celular; uma segunda pessoa (contexto de navegador
// separado, desktop) acompanha a página pública e precisa ver as mudanças pelo stream SSE, sem polling.

let prepared: PreparedTournament

/** Nome do atleta de uma inscrição, para montar os rótulos acessíveis da interface. */
function nameOf(registrationId: string | null): string {
  const found = prepared.registrations.find((r) => r.id === registrationId)
  if (!found?.athleteName) throw new Error(`Inscrição ${registrationId} sem nome de atleta.`)
  return found.athleteName
}

test.beforeEach(async () => {
  // 4 atletas: duas semifinais prontas (quadras 1 e 2) e a final esperando os vencedores.
  prepared = await prepareTournament({ athleteCount: 4, name: `Ao Vivo E2E ${Date.now().toString(36)}` })
  const semis = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
  await scheduleMatch(semis[0]?.id ?? '', 1, '2098-03-10T12:00:00.000Z')
  await scheduleMatch(semis[1]?.id ?? '', 2, '2098-03-10T12:00:00.000Z')
})

test.describe('operador no celular e público em tempo real', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('inicia, marca pontos, desfaz e encerra; o público acompanha pelo SSE e a chave avança', async ({ page, browser }) => {
    const semi = prepared.matches.find((m) => m.round === 2 && m.position === 1)
    if (!semi) throw new Error('semifinal 1 não encontrada')
    const player1 = nameOf(semi.registration1Id)
    const player2 = nameOf(semi.registration2Id)

    // Segunda pessoa: página pública do torneio, aberta ANTES de a partida começar.
    const viewer = await browser.newContext({ baseURL: WEB_URL, locale: 'pt-BR', viewport: { width: 1280, height: 800 } })
    const publicPage = await viewer.newPage()
    const requests: { type: string; url: string }[] = []
    publicPage.on('request', (request) => requests.push({ type: request.resourceType(), url: request.url() }))
    await publicPage.goto(`/t/${prepared.tournament.slug}`)
    const liveNow = publicPage.getByRole('region', { name: 'Ao vivo agora' })
    await expect(liveNow.getByText('Ao vivo', { exact: true })).toBeVisible() // conexão SSE estabelecida
    await expect(liveNow.getByText('Nenhuma partida ao vivo no momento.')).toBeVisible()

    // Operador: escolhe o torneio e a quadra 1.
    await page.goto('/admin/live')
    await expect(page.getByRole('navigation', { name: 'Navegação administrativa' })).toBeVisible() // faixa no lugar da sidebar
    await page.getByLabel('Torneio').selectOption({ label: prepared.tournament.name })
    await page.getByRole('button', { name: /^Quadra 1/ }).click()
    await expect(page.getByText('Próxima partida')).toBeVisible()
    await page.getByRole('button', { name: 'Iniciar' }).click()

    const board = page.getByRole('region', { name: `Partida ao vivo: ${player1} x ${player2}` })
    await expect(board).toBeVisible()
    await expect(board).toContainText('Placar: 0-0')

    // Alvos de toque grandes e nada que force rolagem horizontal no celular.
    const pointButton = board.getByRole('button', { name: `Marcar ponto para ${player1}` })
    expect((await pointButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    // O público vê a partida começar, sem recarregar.
    const publicCard = (score: string) => publicPage.getByRole('article', { name: new RegExp(`Quadra 1, .*${player1} x ${player2}, placar ${score}`) })
    await expect(publicCard('0-0')).toBeVisible({ timeout: 5_000 })
    await expect(publicPage.getByText(`Partida iniciada na quadra 1: ${player1} x ${player2}.`)).toBeAttached()

    // 3 pontos para o primeiro, 1 para o segundo.
    for (let i = 0; i < 3; i++) await pointButton.click()
    await board.getByRole('button', { name: `Marcar ponto para ${player2}` }).click()
    await expect(board).toContainText('Placar: 3-1')
    await expect(publicCard('3-1')).toBeVisible({ timeout: 5_000 })

    // Desfazer remove o último ponto (do segundo) e o público acompanha.
    await board.getByRole('button', { name: 'Desfazer último ponto' }).click()
    await expect(board).toContainText('Placar: 3-0')
    await expect(publicCard('3-0')).toBeVisible({ timeout: 5_000 })
    // A chave pública também mostra o placar corrente no cartão da partida.
    await expect(publicPage.getByRole('group', { name: new RegExp(`^Semifinal, partida 1: .*ao vivo, placar 3-0$`) })).toBeVisible()

    // Resto da partida pela API (42 pontos pela interface seriam só repetição): o primeiro vence por 2 sets a 0.
    const decided = await scoreUntilDecided(prepared.tournament.id, semi.id, 1)
    expect(decided.winner).toBe(1)
    await expect(board.getByRole('status')).toContainText(`${player1} venceu`, { timeout: 8_000 }) // o polling de 3 s do operador
    await expect(publicPage.getByText('Fim de jogo, aguardando confirmação da mesa')).toBeVisible({ timeout: 5_000 })
    await expect(board.getByRole('button', { name: `Marcar ponto para ${player1}` })).toBeDisabled()

    // Encerrar: confirma no diálogo; o placar vira resultado oficial e o vencedor avança.
    await board.getByRole('button', { name: 'Encerrar partida' }).click()
    const confirm = page.getByRole('dialog', { name: 'Encerrar partida?' })
    await expect(confirm).toContainText(`Vencedor: ${player1}`)
    await confirm.getByRole('button', { name: 'Confirmar resultado' }).click()
    await expect(confirm).toBeHidden()
    await expect(board).toBeHidden()

    // Público: o cartão ao vivo some e a chave mostra o vencedor, que já está na final.
    await expect(liveNow.getByText('Nenhuma partida ao vivo no momento.')).toBeVisible({ timeout: 8_000 })
    await expect(publicPage.getByRole('group', { name: new RegExp(`^Semifinal, partida 1: .*vencedor ${player1}$`) })).toBeVisible()
    await expect(publicPage.getByRole('group', { name: new RegExp(`^Final, partida 1: ${player1} contra a definir$`) })).toBeVisible()
    await expect(publicPage.getByText('1 / 3 (33%)')).toBeVisible()

    // Tudo chegou pelo stream: houve uma conexão EventSource e nenhum polling de /live/matches.
    expect(requests.some((r) => r.type === 'eventsource' && r.url.endsWith(`/tournaments/${prepared.tournament.id}/live`))).toBe(true)
    expect(requests.filter((r) => r.url.includes('/live/matches'))).toEqual([])

    // API: resultado oficial gravado e provisório apagado.
    const matches = await listMatches(prepared.draw.id)
    expect(matches.find((m) => m.id === semi.id)?.status).toBe('completed')
    expect(await listLiveMatches(prepared.tournament.id)).toEqual([])
    const sets = await api.get<{ score1: number; score2: number }[]>(`/draws/matches/${semi.id}/result`)
    expect(sets.map((s) => `${s.score1}-${s.score2}`)).toEqual(['21-0', '21-0'])

    await viewer.close()
  })

  test('cancelar o início devolve a partida para a fila e o público deixa de vê-la', async ({ page, browser }) => {
    const semi = prepared.matches.find((m) => m.round === 2 && m.position === 2)
    if (!semi) throw new Error('semifinal 2 não encontrada')

    const viewer = await browser.newContext({ baseURL: WEB_URL, locale: 'pt-BR' })
    const publicPage = await viewer.newPage()
    await publicPage.goto(`/t/${prepared.tournament.slug}`)
    const liveNow = publicPage.getByRole('region', { name: 'Ao vivo agora' })
    await expect(liveNow.getByText('Ao vivo', { exact: true })).toBeVisible()

    await page.goto('/admin/live')
    await page.getByLabel('Torneio').selectOption({ label: prepared.tournament.name })
    await page.getByRole('button', { name: /^Quadra 2/ }).click()
    await page.getByRole('button', { name: 'Iniciar' }).click()
    await expect(page.getByRole('region', { name: /^Partida ao vivo:/ })).toBeVisible()
    await expect(liveNow.getByRole('article')).toHaveCount(1, { timeout: 5_000 })

    await page.getByRole('button', { name: 'Cancelar início da partida' }).click()
    await page.getByRole('dialog', { name: 'Cancelar o início?' }).getByRole('button', { name: 'Descartar placar' }).click()
    await expect(page.getByRole('region', { name: /^Partida ao vivo:/ })).toBeHidden()
    await expect(liveNow.getByText('Nenhuma partida ao vivo no momento.')).toBeVisible({ timeout: 8_000 })

    expect((await listMatches(prepared.draw.id)).find((m) => m.id === semi.id)?.status).toBe('pending')
    await viewer.close()
  })
})

test.describe('operador no celular: quadra selecionada', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test(
    'cancelar o início mantém a quadra selecionada pelo operador',
    async ({ page }) => {
      await page.goto('/admin/live')
      await page.getByLabel('Torneio').selectOption({ label: prepared.tournament.name })
      await page.getByRole('button', { name: /^Quadra 2/ }).click()
      await page.getByRole('button', { name: 'Iniciar' }).click()
      await expect(page.getByRole('region', { name: /^Partida ao vivo:/ })).toBeVisible()
      await page.getByRole('button', { name: 'Cancelar início da partida' }).click()
      await page.getByRole('dialog', { name: 'Cancelar o início?' }).getByRole('button', { name: 'Descartar placar' }).click()
      await expect(page.getByText(/Nenhuma partida em andamento na quadra 2/)).toBeVisible()
      await expect(page.getByRole('button', { name: /^Quadra 2/ })).toHaveAttribute('aria-pressed', 'true')
    },
  )
})

test.describe('regras do placar ao vivo na API', () => {
  test('versão desatualizada é recusada com o placar atual (LIVE_VERSION_CONFLICT)', async () => {
    const semi = prepared.matches.find((m) => m.round === 2 && m.position === 1)
    if (!semi) throw new Error('semifinal 1 não encontrada')
    const started = await api.post<{ version: number }>(`/draws/matches/${semi.id}/live/start`, {})
    const first = await api.post<{ version: number }>(`/draws/matches/${semi.id}/live/point`, { side: 1, version: started.version })

    // Outro operador ainda enxerga a versão anterior.
    const stale = await apiCall<{ code: string; details: { expected: number; current: { version: number } } }>(
      'POST',
      `/draws/matches/${semi.id}/live/point`,
      { side: 2, version: started.version },
    )
    expect(stale.status).toBe(409)
    expect(stale.body.code).toBe('LIVE_VERSION_CONFLICT')
    expect(stale.body.details.current.version).toBe(first.version)
    // Nada foi gravado: o placar continua 1-0.
    const live = (await listLiveMatches(prepared.tournament.id)).find((m) => m.matchId === semi.id)
    expect(live?.currentSet).toMatchObject({ score1: 1, score2: 0 })
  })

  test('uma quadra não aceita duas partidas ao mesmo tempo (COURT_BUSY)', async () => {
    const [first, second] = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
    if (!first || !second) throw new Error('semifinais não encontradas')
    await api.post(`/draws/matches/${first.id}/live/start`, {})
    const busy = await apiCall<{ code: string }>('POST', `/draws/matches/${second.id}/live/start`, { courtNumber: 1 })
    expect(busy.status).toBe(409)
    expect(busy.body.code).toBe('COURT_BUSY')
  })

  test('a leitura pública do stream devolve 404 para torneio inexistente e não vaza dados pessoais', async () => {
    const missing = await apiCall<{ code: string }>('GET', '/tournaments/nao-existe/live')
    expect(missing.status).toBe(404)
    expect(missing.body.code).toBe('TOURNAMENT_NOT_FOUND')
    const semi = prepared.matches.find((m) => m.round === 2 && m.position === 1)
    await api.post(`/draws/matches/${semi?.id}/live/start`, {})
    const json = JSON.stringify(await listLiveMatches(prepared.tournament.id))
    expect(json).not.toMatch(/email|birthDate|cpf|phone/i)
  })
})
