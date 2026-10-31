import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { settle, THEMES, useTheme } from '../support/wcag-page.js'
import {
  createAthletes,
  createCategory,
  createTournament,
  finalizeTournament,
  playWholeDraw,
  prepareTournament,
  registerApproved,
  uniqueTag,
} from '../support/factories.js'

// Sistema suíço: rodadas geradas uma a uma, pareamento sem repetir adversário, bye, trava das rodadas
// anteriores, encerramento com colocação pela classificação e as telas.

interface SwissMatch {
  id: string
  round: number
  roundLabel: string | null
  status: string
  stage: string | null
  registration1Id: string | null
  registration2Id: string | null
}

const matchesOf = (drawId: string) => api.get<SwissMatch[]>(`/draws/${drawId}/matches`)
const swiss = (athleteCount: number) => prepareTournament({ athleteCount, drawType: 'swiss', status: 'in_progress' })

async function nextRound(drawId: string) {
  return api.post<{ round: number; matchCount: number; bye: string | null; rematches: number }>(`/draws/${drawId}/swiss/next-round`)
}

test.describe('suíço (API)', () => {
  test('gera só a rodada 1; o número de rodadas padrão é ⌈log₂ n⌉', async () => {
    const p = await swiss(8)
    const matches = await matchesOf(p.draw.id)
    expect(matches).toHaveLength(4)
    expect(new Set(matches.map((m) => m.roundLabel))).toEqual(new Set(['Rodada 1']))
    expect(matches.every((m) => m.stage === 'swiss')).toBe(true)
    const standings = await api.get<{ rounds: { generated: number; total: number } }>(`/draws/${p.draw.id}/standings`)
    expect(standings.rounds).toEqual({ generated: 1, total: 3 })
  })

  test('rodadas inválidas são recusadas com mensagem em português', async () => {
    const t = await createTournament({ status: 'in_progress' })
    const c = await createCategory(t.id, { drawType: 'swiss' })
    await registerApproved(c.id, await createAthletes(8, { gender: 'M' }))
    const bad = await apiCall<{ code: string; error: string }>('POST', `/draws/generate/${c.id}`, { mode: 'random', swissRounds: 8 })
    expect(bad.status).toBe(422)
    expect(bad.body.code).toBe('INVALID_SWISS_CONFIG')
    expect(bad.body.error).toContain('máximo é 7')
    const ok = await api.post<{ draw: { config: { rounds: number } } }>(`/draws/generate/${c.id}`, { mode: 'random', swissRounds: 5 })
    expect(ok.draw.config).toEqual({ rounds: 5 })
  })

  test('todas as rodadas: ninguém repete adversário, rodadas anteriores travam, colocação 1..n', async () => {
    const p = await swiss(8)
    const early = await apiCall<{ code: string }>('POST', `/draws/${p.draw.id}/swiss/next-round`)
    expect(early.status).toBe(409)
    expect(early.body.code).toBe('ROUND_NOT_FINISHED')

    for (let round = 1; round <= 3; round++) {
      await playWholeDraw(p.draw.id)
      if (round < 3) {
        const created = await nextRound(p.draw.id)
        expect(created).toMatchObject({ round: round + 1, matchCount: 4, bye: null, rematches: 0 })
      }
    }
    const done = await apiCall<{ code: string }>('POST', `/draws/${p.draw.id}/swiss/next-round`)
    expect(done.body.code).toBe('SWISS_ROUNDS_COMPLETE')

    const all = await matchesOf(p.draw.id)
    expect(all).toHaveLength(12)
    const pairs = all.map((m) => [m.registration1Id, m.registration2Id].sort().join('|'))
    expect(new Set(pairs).size).toBe(12) // nenhum confronto repetido

    const first = all.find((m) => m.roundLabel === 'Rodada 1')!
    const locked = await apiCall<{ code: string }>('POST', `/draws/matches/${first.id}/result`, {
      sets: [{ setNumber: 1, score1: 21, score2: 0 }, { setNumber: 2, score1: 21, score2: 0 }],
      status: 'completed',
    })
    expect(locked.status).toBe(409)
    expect(locked.body.code).toBe('ROUND_LOCKED')

    await finalizeTournament(p.tournament.id)
    const regs = await api.get<{ finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    expect(regs.map((r) => r.finalPlacement).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  test('encerrar exige todas as rodadas geradas', async () => {
    const p = await swiss(8)
    await playWholeDraw(p.draw.id)
    const res = await apiCall<{ code: string; details: { incomplete: string[] } }>('POST', `/tournaments/${p.tournament.id}/finalize`)
    expect(res.status).toBe(400)
    expect(res.body.details.incomplete[0]).toContain('faltam rodadas do suíço')
  })

  test('número ímpar: uma folga por rodada, sem repetir quem já folgou', async () => {
    const p = await swiss(5) // ⌈log₂ 5⌉ = 3 rodadas
    const byes: string[] = []
    for (let round = 1; round <= 3; round++) {
      await playWholeDraw(p.draw.id)
      const roundMatches = (await matchesOf(p.draw.id)).filter((m) => m.roundLabel === `Rodada ${round}`)
      expect(roundMatches).toHaveLength(3) // 2 partidas + a folga
      const bye = roundMatches.find((m) => m.registration2Id === null)
      expect(bye?.status).toBe('walkover')
      byes.push(bye!.registration1Id!)
      if (round < 3) await nextRound(p.draw.id)
    }
    expect(new Set(byes).size).toBe(3)
    const standings = await api.get<{ rows: { byes: number; wins: number; played: number }[] }>(`/draws/${p.draw.id}/standings`)
    expect(standings.rows.reduce((sum, r) => sum + r.byes, 0)).toBe(3)
    expect(standings.rows.every((r) => r.played === 3)).toBe(true)
  })
})

test.describe('suíço (interface)', () => {
  test('o admin define as rodadas, sorteia e gera a próxima rodada', async ({ page }) => {
    const tag = uniqueTag()
    const tournament = await createTournament({ status: 'in_progress', name: `Suíço UI ${tag}` })
    const category = await createCategory(tournament.id, { drawType: 'swiss', name: `Suíço ${tag}` })
    await registerApproved(category.id, await createAthletes(6, { gender: 'M', prefix: 'SwUI' }))

    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await page.getByLabel('Número de rodadas').fill('2')
    await page.getByRole('button', { name: 'Sortear chave' }).click()

    await expect(page.getByText('Rodada 1 de 2')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Buchholz' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gerar próxima rodada' })).toBeDisabled()

    const drawId = (await api.get<{ id: string }[]>(`/tournaments/categories/${category.id}/draws`))[0]!.id
    await playWholeDraw(drawId)
    await page.reload()
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await page.getByRole('button', { name: 'Gerar próxima rodada' }).click()
    await expect(page.getByText('Rodada 2 de 2')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rodada 2', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gerar próxima rodada' })).toHaveCount(0)
  })

  test('o formato "Suíço" aparece no cadastro de categorias', async ({ page }) => {
    const tournament = await createTournament({ status: 'draft' })
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Configurações' }).click()
    await page.getByLabel('Formato').selectOption('swiss')
    await page.getByLabel('Nome da categoria').fill('Categoria suíça')
    await page.getByRole('button', { name: 'Criar categoria' }).click()
    await expect(page.getByText('· suíço')).toBeVisible()
  })

  for (const theme of THEMES) {
    test(`portal e admin sem violações de acessibilidade (${theme})`, async ({ page }) => {
      const p = await swiss(5)
      await playWholeDraw(p.draw.id)
      await nextRound(p.draw.id)
      await useTheme(page, theme)

      await page.goto(`/t/${p.tournament.slug}`)
      await expect(page.getByRole('columnheader', { name: 'Buchholz' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Folgas' })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `suíço público [${theme}]`)

      await page.goto(`/admin/tournaments/${p.tournament.id}`)
      await page.getByRole('tab', { name: 'Chaveamento' }).click()
      await expect(page.getByRole('columnheader', { name: 'Buchholz' })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `suíço admin [${theme}]`)
    })
  }
})
