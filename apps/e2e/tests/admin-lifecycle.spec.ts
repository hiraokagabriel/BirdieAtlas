import { expect, test, type Page } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import {
  createAthletes,
  createCategory,
  createTournament,
  listMatches,
  registerApproved,
  type Athlete,
  type Category,
  type Tournament,
} from '../support/factories.js'

// Ciclo de vida completo de um torneio pelo painel admin: abrir inscrições, fechar, iniciar, sortear, publicar,
// lançar resultados pelo diálogo até o campeão, encerrar, conferir a colocação final no perfil público, tentar
// corrigir um resultado com o torneio encerrado (TOURNAMENT_LOCKED), reabrir e encerrar de novo.
// Os atletas, a categoria e as inscrições vêm da API; a interface é o objeto do teste a partir do torneio.

interface Placement {
  athleteId: string
  finalPlacement: number | null
}

interface ProfileResponse {
  tournamentHistory: { tournamentId: string; finalPlacement: number | null }[]
}

let tournament: Tournament
let category: Category
let athletes: Athlete[]

function fail(message: string): never {
  throw new Error(message)
}

async function placements(): Promise<Map<string, number | null>> {
  const regs = await api.get<Placement[]>(`/tournaments/categories/${category.id}/registrations`)
  return new Map(regs.map((r) => [r.athleteId, r.finalPlacement]))
}

async function profilePlacement(athlete: Athlete): Promise<number | null | undefined> {
  const profile = await api.get<ProfileResponse>(`/athletes/${athlete.id}/profile`)
  return profile.tournamentHistory.find((h) => h.tournamentId === tournament.id)?.finalPlacement
}

/** Abre a partida ainda sem vencedor (a primeira pronta) e lança um resultado de 2 sets. */
async function enterNextResult(page: Page, sets: [[string, string], [string, string]] = [['21', '15'], ['21', '12']]): Promise<void> {
  const pending = page.getByRole('button', { name: /^(?!.*vencedor).*Abrir resultado/ })
  await pending.first().click()
  await fillResultDialog(page, sets, /Confirmar resultado/)
}

async function fillResultDialog(page: Page, sets: [[string, string], [string, string]], submit: RegExp): Promise<void> {
  const dialog = page.getByRole('dialog', { name: /Lançar Resultado|Editar Resultado/ })
  const scores = dialog.getByRole('spinbutton')
  await expect(scores).toHaveCount(4)
  await scores.nth(0).fill(sets[0][0])
  await scores.nth(1).fill(sets[0][1])
  await scores.nth(2).fill(sets[1][0])
  await scores.nth(3).fill(sets[1][1])
  await dialog.getByRole('button', { name: submit }).click()
}

test.describe.serial('ciclo de vida do torneio no admin', () => {
  test.beforeAll(async () => {
    tournament = await createTournament({ name: `Ciclo de Vida ${Date.now().toString(36)}` })
    category = await createCategory(tournament.id)
    athletes = await createAthletes(4, { gender: 'M', prefix: 'Ciclo' })
    await registerApproved(category.id, athletes)
  })

  test('abre inscrições, encerra inscrições e inicia o torneio', async ({ page }) => {
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await expect(page.getByRole('heading', { name: tournament.name })).toBeVisible()
    await expect(page.getByText('Rascunho', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Abrir inscrições' }).click()
    await expect(page.getByText('Inscrições abertas', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Encerrar inscrições' }).click()
    await expect(page.getByText('Inscrições encerradas', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Iniciar torneio' }).click()
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Encerrar campeonato' })).toBeVisible()

    expect((await api.get<Tournament>(`/tournaments/${tournament.id}`)).status).toBe('in_progress')
  })

  test('a aba Inscrições lista os atletas aprovados', async ({ page }) => {
    await page.goto(`/admin/tournaments/${tournament.id}`)
    for (const athlete of athletes) await expect(page.getByText(athlete.name).first()).toBeVisible()
  })

  test('sorteia a chave e publica', async ({ page }) => {
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()

    await expect(page.getByText('Chave ainda não sorteada')).toBeVisible()
    // Modo de sorteio é um grupo de rádios; o usuário clica no cartão (o <input> fica escondido).
    await page.getByText('Sorteio Aleatório', { exact: true }).click()
    await page.getByRole('button', { name: 'Sortear chave' }).click()

    const bracket = page.getByRole('region', { name: 'Chave de Simples Masculino' })
    await expect(bracket).toBeVisible()
    await expect(bracket.getByRole('region', { name: 'Semifinal', exact: true })).toBeVisible()
    await expect(bracket.getByRole('region', { name: 'Final', exact: true })).toBeVisible()
    await expect(page.getByText('Rascunho — não visível na página pública')).toBeVisible()

    // Chave publicada bloqueia o ressorteio.
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText('Chaveamento publicado — visível na página pública')).toBeVisible()
    await expect(page.getByTitle('Despublique a chave antes de ressortear')).toBeVisible()

    const matches = await listMatches((await api.get<{ id: string }[]>(`/tournaments/categories/${category.id}/draws`))[0]?.id ?? '')
    expect(matches).toHaveLength(3)
  })

  test('lança os resultados pelo diálogo até aparecer o campeão', async ({ page }) => {
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    const bracket = page.getByRole('region', { name: 'Chave de Simples Masculino' })
    await expect(bracket).toBeVisible()
    await expect(page.getByText(/^Campeão$/)).toHaveCount(0)

    // Validação do diálogo: placar empatado não confirma.
    const pending = page.getByRole('button', { name: /^(?!.*vencedor).*Abrir resultado/ })
    await expect(pending).toHaveCount(2)
    await pending.first().click()
    const dialog = page.getByRole('dialog', { name: 'Lançar Resultado' })
    await dialog.getByRole('button', { name: 'Confirmar resultado' }).click()
    await expect(dialog.getByText('Preencha ao menos 2 games.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()

    // Semifinais: o lado de cima vence as duas.
    await enterNextResult(page)
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(bracket.getByRole('button', { name: /vencedor.*Abrir resultado/ })).toHaveCount(1)
    await enterNextResult(page)
    await expect(bracket.getByRole('button', { name: /vencedor.*Abrir resultado/ })).toHaveCount(2)

    // Final: agora as duas vagas têm atleta.
    await expect(pending).toHaveCount(1)
    await expect(page.getByText(/^Campeão$/)).toHaveCount(0)
    await enterNextResult(page)
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect(page.getByText(/^Campeão$/).first()).toBeVisible()
    await expect(page.getByText(/^Vice:/)).toBeVisible()
    await expect(page.getByText('Todas as partidas encerradas')).toBeVisible()
    await expect(pending).toHaveCount(0)

    const matches = await listMatches((await api.get<{ id: string }[]>(`/tournaments/categories/${category.id}/draws`))[0]?.id ?? '')
    expect(matches.every((m) => m.status === 'completed')).toBe(true)
  })

  test('encerra o campeonato e a colocação final aparece no perfil público', async ({ page }) => {
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('button', { name: 'Encerrar campeonato' }).click()
    await expect(page.getByRole('heading', { name: 'Encerrar Campeonato' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar encerramento' }).click()

    await expect(page.getByText('Campeonato encerrado com sucesso!')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Relatório Final' })).toBeVisible()
    await page.getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('main').getByText('Encerrado', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reabrir campeonato' })).toBeVisible()

    // finalPlacement gravado: 1º, 2º e os dois semifinalistas em 3º.
    const afterFinalize = await placements()
    expect([...afterFinalize.values()].sort()).toEqual([1, 2, 3, 3])
    const championId = [...afterFinalize.entries()].find(([, p]) => p === 1)?.[0]
    const champion = athletes.find((a) => a.id === championId)
    expect(champion).toBeDefined()
    if (!champion) return

    // E o perfil público do campeão mostra o 1º lugar e o título.
    await page.goto(`/a/${champion.id}`)
    const entry = page.getByRole('region', { name: 'Histórico de torneios' }).getByRole('listitem').filter({ hasText: tournament.name })
    await expect(entry.getByText('1º lugar')).toBeAttached()
    await expect(page.getByRole('term').filter({ hasText: 'Títulos' }).locator('..').getByRole('definition')).toHaveText('1')
    expect(await profilePlacement(champion)).toBe(1)
  })

  test('com o torneio encerrado, corrigir um resultado mostra TOURNAMENT_LOCKED', async ({ page }) => {
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    const bracket = page.getByRole('region', { name: 'Chave de Simples Masculino' })
    await expect(bracket).toBeVisible()

    await bracket.getByRole('button', { name: /^Final.*vencedor.*Abrir resultado/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar Resultado' })
    await fillResultDialog(page, [['10', '21'], ['12', '21']], /Salvar alterações/)

    const alert = dialog.getByRole('alert')
    await expect(alert).toHaveText('O torneio está encerrado. Reabra-o para alterar resultados.')
    await expect(dialog).toBeVisible() // o diálogo continua aberto, com o erro
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()

    // Mesma regra direto na API, com o código do contrato.
    const final = (await listMatches((await api.get<{ id: string }[]>(`/tournaments/categories/${category.id}/draws`))[0]?.id ?? '')).find((m) => m.round === 1)
    const locked = await apiCall<{ code: string }>('POST', `/draws/matches/${final?.id}/result`, {
      sets: [{ setNumber: 1, score1: 1, score2: 21 }, { setNumber: 2, score1: 1, score2: 21 }],
      status: 'completed',
    })
    expect(locked.status).toBe(409)
    expect(locked.body.code).toBe('TOURNAMENT_LOCKED')
  })

  test('reabre, corrige o resultado da final e encerra de novo', async ({ page }) => {
    const before = await placements()
    const oldChampionId = [...before.entries()].find(([, p]) => p === 1)?.[0]
    const oldRunnerUpId = [...before.entries()].find(([, p]) => p === 2)?.[0]
    expect(oldChampionId).toBeDefined()
    expect(oldRunnerUpId).toBeDefined()

    await page.goto(`/admin/tournaments/${tournament.id}`)
    page.once('dialog', (confirmation) => {
      expect(confirmation.message()).toContain('Reabrir o campeonato?')
      void confirmation.accept()
    })
    await page.getByRole('button', { name: 'Reabrir campeonato' }).click()
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Encerrar campeonato' })).toBeVisible()

    // Reabrir zera a colocação final (os resultados podem mudar).
    expect([...(await placements()).values()]).toEqual([null, null, null, null])
    expect(await profilePlacement(athletes[0] ?? fail('sem atletas'))).toBeNull()

    // Agora a correção é aceita: o vice vira campeão.
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    const bracket = page.getByRole('region', { name: 'Chave de Simples Masculino' })
    await bracket.getByRole('button', { name: /^Final.*vencedor.*Abrir resultado/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar Resultado' })
    await expect(dialog.getByRole('spinbutton').nth(0)).toHaveValue('21') // o lado de cima tinha vencido
    await fillResultDialog(page, [['10', '21'], ['12', '21']], /Salvar alterações/)
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'Encerrar campeonato' }).click()
    await page.getByRole('button', { name: 'Confirmar encerramento' }).click()
    await expect(page.getByText('Campeonato encerrado com sucesso!')).toBeVisible()
    await page.getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('main').getByText('Encerrado', { exact: true })).toBeVisible()

    const after = await placements()
    expect(after.get(oldRunnerUpId ?? '')).toBe(1)
    expect(after.get(oldChampionId ?? '')).toBe(2)
    expect([...after.values()].sort()).toEqual([1, 2, 3, 3])
  })
})

test.describe('encerramento com chaves incompletas', () => {
  test('o servidor recusa encerrar torneio com partidas pendentes', async () => {
    const t = await createTournament({ status: 'in_progress' })
    const c = await createCategory(t.id)
    const a = await createAthletes(4, { gender: 'M' })
    await registerApproved(c.id, a)
    await api.post(`/draws/generate/${c.id}`, { mode: 'random' })

    const result = await apiCall<{ error: string; incomplete?: string[] }>('POST', `/tournaments/${t.id}/finalize`)
    expect(result.status).toBe(400)
    expect(result.body.incomplete?.[0]).toContain('partida(s) pendente(s)')
  })

  test('o modal de encerramento explica o que falta', async ({ page }) => {
    const t = await createTournament({ status: 'in_progress' })
    const c = await createCategory(t.id)
    const a = await createAthletes(4, { gender: 'M' })
    await registerApproved(c.id, a)
    await api.post(`/draws/generate/${c.id}`, { mode: 'random' })

    await page.goto(`/admin/tournaments/${t.id}`)
    await page.getByRole('button', { name: 'Encerrar campeonato' }).click()
    await page.getByRole('button', { name: 'Confirmar encerramento' }).click()
    // A mensagem da API precisa chegar à pessoa (hoje o modal lê `error` de um ApiError, que só tem `message`).
    await expect(page.getByText('Nao e possivel encerrar: existem chaves incompletas.')).toBeVisible()
  })
})
