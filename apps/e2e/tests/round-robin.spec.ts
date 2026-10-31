import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { settle, THEMES, useTheme } from '../support/wcag-page.js'
import {
  completeTournament,
  createAthletes,
  createCategory,
  createRankingWithRules,
  createTournament,
  prepareTournament,
  recordResult,
  registerApproved,
  SIDE2_WINS,
  uniqueTag,
} from '../support/factories.js'

// Todos contra todos (round robin): geração, classificação, encerramento com colocação pela
// classificação, pontos no ranking e as telas (admin e público).

interface RoundRobinMatch {
  id: string
  round: number
  roundLabel: string | null
  registration1Id: string | null
  registration2Id: string | null
  status: string
}

interface StandingRow {
  position: number
  registrationId: string
  played: number
  wins: number
  losses: number
}

test.describe('todos contra todos', () => {
  test('gera todas as partidas, uma por par, em rodadas nomeadas', async () => {
    const prepared = await prepareTournament({ athleteCount: 4, drawType: 'round_robin' })
    const matches = await api.get<RoundRobinMatch[]>(`/draws/${prepared.draw.id}/matches`)

    expect(matches).toHaveLength(6) // 4 inscritos: 4*3/2 partidas
    const pairs = new Set(matches.map((m) => [m.registration1Id, m.registration2Id].sort().join('|')))
    expect(pairs.size).toBe(6)
    expect(new Set(matches.map((m) => m.roundLabel))).toEqual(new Set(['Rodada 1', 'Rodada 2', 'Rodada 3']))
    expect(matches.every((m) => m.status === 'pending')).toBe(true)
  })

  test('com número ímpar de inscritos quem folga não gera partida', async () => {
    const prepared = await prepareTournament({ athleteCount: 5, drawType: 'round_robin' })
    const matches = await api.get<RoundRobinMatch[]>(`/draws/${prepared.draw.id}/matches`)
    expect(matches).toHaveLength(10)
    expect(matches.every((m) => m.registration1Id && m.registration2Id)).toBe(true)
  })

  test('a classificação segue as vitórias e o encerramento grava a colocação pela classificação', async () => {
    const prepared = await prepareTournament({ athleteCount: 4, drawType: 'round_robin' })
    const matches = await api.get<RoundRobinMatch[]>(`/draws/${prepared.draw.id}/matches`)

    const before = await api.get<{ rows: StandingRow[] }>(`/draws/${prepared.draw.id}/standings`)
    expect(before.rows).toHaveLength(0 + new Set(matches.flatMap((m) => [m.registration1Id, m.registration2Id])).size)
    expect(before.rows.every((r) => r.played === 0)).toBe(true)

    // Não dá para encerrar com partidas pendentes.
    const early = await apiCall<{ code?: string }>('POST', `/tournaments/${prepared.tournament.id}/finalize`)
    expect(early.status).toBe(400)
    expect(early.body.code).toBe('INCOMPLETE_DRAWS')

    await completeTournament(prepared)
    const after = await api.get<{ rows: StandingRow[] }>(`/draws/${prepared.draw.id}/standings`)
    const wins = after.rows.map((r) => r.wins)
    expect(wins).toEqual([...wins].sort((a, b) => b - a)) // classificação em ordem de vitórias
    expect(wins.reduce((a, b) => a + b, 0)).toBe(6) // uma vitória por partida
    expect(after.rows.every((r) => r.played === 3)).toBe(true)

    const regs = await api.get<{ id: string; finalPlacement: number | null }[]>(`/tournaments/categories/${prepared.category.id}/registrations`)
    expect(regs.map((r) => r.finalPlacement).sort()).toEqual([1, 2, 3, 4])
    const champion = regs.find((r) => r.finalPlacement === 1)
    expect(champion?.id).toBe(after.rows[0]?.registrationId)
  })

  test('o resultado inverte a classificação e a pontuação do ranking usa a colocação', async () => {
    const tag = uniqueTag()
    const athletes = await createAthletes(3, { gender: 'M', prefix: 'RR' })
    const prepared = await prepareTournament({ athletes, drawType: 'round_robin', level: 'international', name: `RR Pontos ${tag}` })

    const matches = await api.get<RoundRobinMatch[]>(`/draws/${prepared.draw.id}/matches`)
    // O inscrito do lado 2 da primeira partida vence tudo o que joga.
    const target = matches[0]!.registration2Id!
    for (const m of matches) await recordResult(m.id, m.registration2Id === target ? SIDE2_WINS : undefined)
    const standings = await api.get<{ rows: StandingRow[] }>(`/draws/${prepared.draw.id}/standings`)
    expect(standings.rows[0]?.registrationId).toBe(target)

    const ranking = await createRankingWithRules({ year: 2036, level: 'international' })
    await api.post(`/tournaments/${prepared.tournament.id}/finalize`)
    await api.post(`/tournaments/${prepared.tournament.id}/award-points`)
    const entries = await api.get<{ data: { position: number; totalPoints: number; athleteId: string }[] }>(`/rankings/${ranking.id}/entries`)
    expect(entries.data).toHaveLength(3)
    expect(entries.data[0]?.totalPoints).toBe(105) // 1º lugar: 100 + bônus 5
    await apiCall('DELETE', `/rankings/${ranking.id}`)
  })
})

test.describe('todos contra todos na interface', () => {
  test('cria a categoria com o formato, sorteia, lança resultado e mostra a classificação', async ({ page }) => {
    const tag = uniqueTag()
    const tournament = await createTournament({ status: 'in_progress', name: `RR UI ${tag}` })
    const category = await createCategory(tournament.id, { drawType: 'round_robin', name: `Grupo ${tag}` })
    const athletes = await createAthletes(3, { gender: 'M', prefix: 'RRUI' })
    await registerApproved(category.id, athletes)

    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await page.getByRole('button', { name: 'Sortear chave' }).click()

    await expect(page.getByRole('heading', { name: 'Classificação' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rodada 1' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()

    await page.getByRole('button', { name: /Abrir resultado/ }).first().click()
    const dialog = page.getByRole('dialog', { name: /Lançar Resultado/ })
    const scores = dialog.getByRole('spinbutton')
    await scores.nth(0).fill('21')
    await scores.nth(1).fill('10')
    await scores.nth(2).fill('21')
    await scores.nth(3).fill('10')
    await dialog.getByRole('button', { name: /Confirmar resultado/ }).click()
    await expect(dialog).toBeHidden()

    // A classificação é refeita: alguém tem 1 vitória.
    await expect(page.getByRole('table').getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('1')
  })

  test('o formato "Todos contra todos" aparece no cadastro de categorias', async ({ page }) => {
    const tournament = await createTournament({ status: 'draft' })
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Configurações' }).click()
    await page.getByLabel('Formato').selectOption('round_robin')
    await page.getByLabel('Nome da categoria').fill('Fase de grupos')
    await page.getByRole('button', { name: 'Criar categoria' }).click()
    await expect(page.getByText('· todos contra todos')).toBeVisible()
  })

  test('o portal público mostra a classificação do todos contra todos', async ({ page }) => {
    const prepared = await prepareTournament({ athleteCount: 4, drawType: 'round_robin', status: 'in_progress' })
    await completeTournament(prepared)
    await page.goto(`/t/${prepared.tournament.slug}`)
    await expect(page.getByRole('region', { name: /^Classificação/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rodada 1' })).toBeVisible()
  })
})

test.describe('acessibilidade do todos contra todos', () => {
  for (const theme of THEMES) {
    test(`admin e público sem violações (${theme})`, async ({ page }) => {
      const prepared = await prepareTournament({ athleteCount: 4, drawType: 'round_robin', status: 'in_progress' })
      await completeTournament(prepared)
      await useTheme(page, theme)

      await page.goto(`/t/${prepared.tournament.slug}`)
      await expect(page.getByRole('table')).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `todos contra todos público [${theme}]`)

      await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
      await page.getByRole('tab', { name: 'Chaveamento' }).click()
      await expect(page.getByRole('table')).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `todos contra todos admin [${theme}]`)
    })
  }
})
