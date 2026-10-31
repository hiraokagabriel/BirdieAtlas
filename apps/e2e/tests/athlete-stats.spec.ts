import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { settle, THEMES, useTheme } from '../support/wcag-page.js'
import { completeTournament, prepareTournament, type Athlete } from '../support/factories.js'

// Estatísticas de partidas e confronto direto (portal público). Torneio de 4 atletas jogado até o fim,
// com o lado 1 vencendo todas as partidas; os dois finalistas se enfrentam uma vez.

interface Stats {
  summary: { played: number; wins: number; losses: number; winRate: number; setsWon: number; setsLost: number }
  longestWinStreak: number
  titles: number
  recent: { result: 'W' | 'L' | null; opponents: { id: string; name: string }[] }[]
}

interface HeadToHead {
  athlete: { id: string; name: string }
  opponent: { id: string; name: string }
  summary: { played: number; wins: number; losses: number }
  matches: { result: 'W' | 'L'; score: string }[]
}

let champion: Athlete
let runnerUp: Athlete
let tournamentName: string

test.beforeAll(async () => {
  const prepared = await prepareTournament({ athleteCount: 4, name: `Estatísticas ${Date.now().toString(36)}` })
  const report = await completeTournament(prepared)
  tournamentName = prepared.tournament.name
  const podium = report.report[0]?.podium ?? []
  const byPlacement = (placement: number) => prepared.athletes.find((a) => a.id === podium.find((p) => p.placement === placement)?.athleteId)
  const first = byPlacement(1)
  const second = byPlacement(2)
  if (!first || !second) throw new Error('Pódio do torneio de teste incompleto.')
  champion = first
  runnerUp = second
})

test.describe('estatísticas de partidas (API)', () => {
  test('campeão: duas vitórias, título e sequência', async () => {
    const stats = await api.get<Stats>(`/athletes/${champion.id}/stats`)
    expect(stats.summary).toMatchObject({ played: 2, wins: 2, losses: 0, winRate: 100 })
    expect(stats.titles).toBe(1)
    expect(stats.longestWinStreak).toBe(2)
    expect(stats.recent).toHaveLength(2)
    expect(stats.recent.every((m) => m.result === 'W')).toBe(true)
  })

  test('vice: uma vitória, uma derrota e 50% de aproveitamento', async () => {
    const stats = await api.get<Stats>(`/athletes/${runnerUp.id}/stats`)
    expect(stats.summary).toMatchObject({ played: 2, wins: 1, losses: 1, winRate: 50 })
    expect(stats.titles).toBe(0)
  })

  test('confronto direto: a final entre os dois', async () => {
    const h2h = await api.get<HeadToHead>(`/athletes/${champion.id}/head-to-head/${runnerUp.id}`)
    expect(h2h.summary).toMatchObject({ played: 1, wins: 1, losses: 0 })
    expect(h2h.matches).toHaveLength(1)
    expect(h2h.matches[0]?.result).toBe('W')
    expect(h2h.matches[0]?.score).toMatch(/^\d+-\d+( \d+-\d+)*$/)

    const reverse = await api.get<HeadToHead>(`/athletes/${runnerUp.id}/head-to-head/${champion.id}`)
    expect(reverse.summary).toMatchObject({ played: 1, wins: 0, losses: 1 })
  })

  test('erros: mesmo atleta, atleta inexistente e dados pessoais', async () => {
    const same = await apiCall<{ code: string }>('GET', `/athletes/${champion.id}/head-to-head/${champion.id}`)
    expect(same.status).toBe(400)
    expect(same.body.code).toBe('SAME_ATHLETE')

    const missing = await apiCall('GET', `/athletes/${champion.id}/head-to-head/nao-existe`)
    expect(missing.status).toBe(404)
    expect((await apiCall('GET', '/athletes/nao-existe/stats')).status).toBe(404)

    const raw = JSON.stringify((await apiCall('GET', `/athletes/${champion.id}/stats`)).body)
    expect(raw).not.toMatch(/@|birthDate|email/i)
  })
})

test.describe('estatísticas de partidas (portal)', () => {
  test('o perfil mostra os números, as últimas partidas e leva ao confronto direto', async ({ page }) => {
    await page.goto(`/a/${champion.id}`)
    const section = page.getByRole('region', { name: 'Partidas' })
    await expect(section.getByRole('term').filter({ hasText: 'Vitórias' })).toBeVisible()
    await expect(section.getByText('100%')).toBeVisible()
    await expect(section.getByRole('link', { name: tournamentName }).first()).toBeVisible()

    await page.getByRole('searchbox', { name: 'Comparar com outro atleta' }).fill(runnerUp.name)
    // Só o link do seletor (o adversário também aparece nas últimas partidas).
    await page.getByRole('region', { name: 'Confronto direto' }).getByRole('link', { name: new RegExp(runnerUp.name) }).click()
    await expect(page).toHaveURL(new RegExp(`/a/${champion.id}/vs/${runnerUp.id}$`))

    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${champion.name}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${runnerUp.name}`)
    await expect(page.getByRole('heading', { name: 'Partidas', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: tournamentName })).toBeVisible()
  })

  test('confronto sem partidas em comum mostra o aviso', async ({ page }) => {
    const other = await prepareTournament({ athleteCount: 2 })
    const lone = other.athletes[0]
    if (!lone) throw new Error('sem atleta')
    await page.goto(`/a/${champion.id}/vs/${lone.id}`)
    await expect(page.getByText('ainda não se enfrentaram')).toBeVisible()
  })

  test('atleta inexistente no confronto leva à página de não encontrado', async ({ page }) => {
    await page.goto(`/a/${champion.id}/vs/00000000-0000-4000-8000-000000000000`)
    await expect(page.getByRole('heading', { level: 1, name: 'Atleta não encontrado' })).toBeVisible()
  })

  for (const theme of THEMES) {
    test(`perfil e confronto sem violações de acessibilidade (${theme})`, async ({ page }) => {
      await useTheme(page, theme)
      await page.goto(`/a/${champion.id}`)
      await expect(page.getByRole('region', { name: 'Partidas' })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `perfil com estatísticas [${theme}]`)

      await page.goto(`/a/${champion.id}/vs/${runnerUp.id}`)
      await expect(page.getByRole('heading', { name: 'Partidas', exact: true })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `confronto direto [${theme}]`)
    })
  }
})
