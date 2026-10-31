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
  recordResult,
  registerApproved,
  SIDE2_WINS,
  uniqueTag,
} from '../support/factories.js'

// Eliminação dupla: chave dos vencedores e dos perdedores, grande final com ou sem reset, edição de
// resultados em cascata, encerramento com colocação e as telas.

interface DeMatch {
  id: string
  round: number
  roundLabel: string | null
  stage: 'winners' | 'losers' | 'grand_final' | 'grand_final_reset' | null
  status: string
  registration1Id: string | null
  registration2Id: string | null
  nextMatchId: string | null
  loserNextMatchId: string | null
}

const matchesOf = (drawId: string) => api.get<DeMatch[]>(`/draws/${drawId}/matches`)
const de = (athleteCount: number) => prepareTournament({ athleteCount, drawType: 'double_elimination', status: 'in_progress' })

/** Joga tudo que está pronto, menos a grande final (e o reset), com o lado 1 vencendo. */
async function playUntilGrandFinal(drawId: string): Promise<void> {
  for (let guard = 0; guard < 40; guard++) {
    const ready = (await matchesOf(drawId)).filter(
      (m) => m.status === 'pending' && m.registration1Id && m.registration2Id && m.stage !== 'grand_final' && m.stage !== 'grand_final_reset',
    )
    if (ready.length === 0) return
    for (const m of ready) await recordResult(m.id)
  }
  throw new Error('chave dos vencedores/perdedores não terminou')
}

test.describe('eliminação dupla (API)', () => {
  test('8 inscritos: 7 partidas dos vencedores, 6 dos perdedores, grande final e reset', async () => {
    const p = await de(8)
    const matches = await matchesOf(p.draw.id)
    const count = (stage: string) => matches.filter((m) => m.stage === stage).length
    expect(count('winners')).toBe(7)
    expect(count('losers')).toBe(6)
    expect(count('grand_final')).toBe(1)
    expect(count('grand_final_reset')).toBe(1)
    expect(matches.find((m) => m.stage === 'grand_final')!.roundLabel).toBe('Grande final')
    expect(matches.some((m) => m.roundLabel === 'Final dos perdedores')).toBe(true)
    const draw = (await api.get<{ config: { reset: boolean } }[]>(`/tournaments/categories/${p.category.id}/draws`))[0]!
    expect(draw.config).toEqual({ reset: true })
  })

  test('sem reset não existe a partida de reset; menos de 3 inscritos é recusado', async () => {
    const t = await createTournament({ status: 'in_progress' })
    const c = await createCategory(t.id, { drawType: 'double_elimination' })
    await registerApproved(c.id, await createAthletes(2, { gender: 'M' }))
    const bad = await apiCall<{ code: string; error: string }>('POST', `/draws/generate/${c.id}`)
    expect(bad.status).toBe(422)
    expect(bad.body.code).toBe('INVALID_DOUBLE_ELIMINATION_CONFIG')
    expect(bad.body.error).toContain('pelo menos 3')

    const t2 = await createTournament({ status: 'in_progress' })
    const c2 = await createCategory(t2.id, { drawType: 'double_elimination' })
    await registerApproved(c2.id, await createAthletes(4, { gender: 'M' }))
    const ok = await api.post<{ draw: { id: string; config: { reset: boolean } } }>(`/draws/generate/${c2.id}`, { doubleEliminationReset: false })
    expect(ok.draw.config).toEqual({ reset: false })
    expect((await matchesOf(ok.draw.id)).some((m) => m.stage === 'grand_final_reset')).toBe(false)
  })

  test('campeão dos vencedores ganha a grande final: sem reset, encerra com colocações 1,2,3,4,5,5,7,7', async () => {
    const p = await de(8)
    await playWholeDraw(p.draw.id)
    const all = await matchesOf(p.draw.id)
    expect(all.filter((m) => m.status !== 'pending')).toHaveLength(14) // 2n-2
    const reset = all.find((m) => m.stage === 'grand_final_reset')!
    expect(reset).toMatchObject({ status: 'pending', registration1Id: null, registration2Id: null })

    await finalizeTournament(p.tournament.id) // o reset vazio não bloqueia o encerramento
    const regs = await api.get<{ finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    expect(regs.map((r) => r.finalPlacement).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3, 4, 5, 5, 7, 7])
  })

  test('campeão dos perdedores vence a grande final: o reset é jogado e decide; encerrar espera por ele', async () => {
    const p = await de(8)
    await playUntilGrandFinal(p.draw.id)
    const gf = (await matchesOf(p.draw.id)).find((m) => m.stage === 'grand_final')!
    expect(gf.registration1Id && gf.registration2Id).toBeTruthy()
    await recordResult(gf.id, SIDE2_WINS)

    const afterGf = await matchesOf(p.draw.id)
    const reset = afterGf.find((m) => m.stage === 'grand_final_reset')!
    expect(reset.registration1Id).toBe(gf.registration1Id)
    expect(reset.registration2Id).toBe(gf.registration2Id)

    const early = await apiCall<{ code: string }>('POST', `/tournaments/${p.tournament.id}/finalize`)
    expect(early.status).toBe(400)
    expect(early.body.code).toBe('INCOMPLETE_DRAWS')

    await recordResult(reset.id, SIDE2_WINS) // o campeão dos perdedores vence de novo
    await finalizeTournament(p.tournament.id)
    const regs = await api.get<{ id: string; finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    expect(regs.find((r) => r.id === gf.registration2Id)?.finalPlacement).toBe(1)
    expect(regs.find((r) => r.id === gf.registration1Id)?.finalPlacement).toBe(2)
  })

  test('campeão dos vencedores também vence o reset: o título fica com ele', async () => {
    const p = await de(4)
    await playUntilGrandFinal(p.draw.id)
    const gf = (await matchesOf(p.draw.id)).find((m) => m.stage === 'grand_final')!
    await recordResult(gf.id, SIDE2_WINS)
    const reset = (await matchesOf(p.draw.id)).find((m) => m.stage === 'grand_final_reset')!
    await recordResult(reset.id) // lado 1 = campeão dos vencedores
    await finalizeTournament(p.tournament.id)
    const regs = await api.get<{ id: string; finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    expect(regs.find((r) => r.id === gf.registration1Id)?.finalPlacement).toBe(1)
    expect(regs.find((r) => r.id === gf.registration2Id)?.finalPlacement).toBe(2)
  })

  test('sem reset a grande final decide direto', async () => {
    const t = await createTournament({ status: 'in_progress' })
    const c = await createCategory(t.id, { drawType: 'double_elimination' })
    await registerApproved(c.id, await createAthletes(4, { gender: 'M' }))
    const draw = (await api.post<{ draw: { id: string } }>(`/draws/generate/${c.id}`, { doubleEliminationReset: false })).draw
    await playUntilGrandFinal(draw.id)
    const gf = (await matchesOf(draw.id)).find((m) => m.stage === 'grand_final')!
    await recordResult(gf.id, SIDE2_WINS)
    await finalizeTournament(t.id)
    const regs = await api.get<{ id: string; finalPlacement: number | null }[]>(`/tournaments/categories/${c.id}/registrations`)
    expect(regs.find((r) => r.id === gf.registration2Id)?.finalPlacement).toBe(1)
  })

  test('corrigir um resultado antigo desfaz em cascata o que dependia dele e a chave termina de novo', async () => {
    const p = await de(8)
    await playWholeDraw(p.draw.id)
    const done = await matchesOf(p.draw.id)
    const firstRound = done.filter((m) => m.stage === 'winners' && m.status === 'completed' && m.registration1Id && m.registration2Id).sort((a, b) => b.round - a.round)[0]!
    await recordResult(firstRound.id, SIDE2_WINS) // vencedor da 1ª partida muda

    const after = await matchesOf(p.draw.id)
    expect(after.filter((m) => m.status === 'pending' && m.stage !== 'grand_final_reset').length).toBeGreaterThan(0)
    // Nenhuma partida encerrada ficou sem os dois lados.
    expect(after.filter((m) => m.status === 'completed').every((m) => m.registration1Id && m.registration2Id)).toBe(true)
    // E ninguém aparece em dois lugares ao mesmo tempo.
    const inPending = after.filter((m) => m.status === 'pending').flatMap((m) => [m.registration1Id, m.registration2Id]).filter(Boolean)
    expect(new Set(inPending).size).toBeLessThanOrEqual(8)

    await playWholeDraw(p.draw.id)
    await finalizeTournament(p.tournament.id)
    const regs = await api.get<{ finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    expect(regs.map((r) => r.finalPlacement).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3, 4, 5, 5, 7, 7])
  })

  test('número ímpar de inscritos (5): byes na primeira rodada e chave completa', async () => {
    const p = await de(5)
    await playWholeDraw(p.draw.id)
    const all = await matchesOf(p.draw.id)
    expect(all.filter((m) => m.status === 'completed' && m.registration1Id && m.registration2Id).length).toBe(2 * 5 - 2 - 0)
    await finalizeTournament(p.tournament.id)
    const regs = await api.get<{ finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    expect(new Set(regs.map((r) => r.finalPlacement)).size).toBeGreaterThanOrEqual(4)
    expect(regs.every((r) => r.finalPlacement !== null)).toBe(true)
  })
})

test.describe('eliminação dupla (interface)', () => {
  test('o admin escolhe o reset, sorteia e vê as três partes da chave', async ({ page }) => {
    const tag = uniqueTag()
    const tournament = await createTournament({ status: 'in_progress', name: `DE UI ${tag}` })
    const category = await createCategory(tournament.id, { drawType: 'double_elimination', name: `Dupla ${tag}` })
    await registerApproved(category.id, await createAthletes(4, { gender: 'M', prefix: 'DEUI' }))

    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    const reset = page.getByRole('checkbox', { name: /Grande final com reset/ })
    await expect(reset).toBeChecked()
    await reset.uncheck()
    await page.getByRole('button', { name: 'Sortear chave' }).click()

    await expect(page.getByRole('heading', { name: 'Chave dos vencedores' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Chave dos perdedores' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Grande final' })).toBeVisible()
    await expect(page.getByText('Há reset')).toHaveCount(0)

    const drawId = (await api.get<{ id: string; config: { reset: boolean } }[]>(`/tournaments/categories/${category.id}/draws`))[0]!
    expect(drawId.config).toEqual({ reset: false })
  })

  test('o formato "Eliminação dupla" aparece no cadastro de categorias', async ({ page }) => {
    const tournament = await createTournament({ status: 'draft' })
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Configurações' }).click()
    await page.getByLabel('Formato').selectOption('double_elimination')
    await page.getByLabel('Nome da categoria').fill('Fase dupla')
    await page.getByRole('button', { name: 'Criar categoria' }).click()
    await expect(page.getByText('· eliminação dupla')).toBeVisible()
  })

  for (const theme of THEMES) {
    test(`portal e admin sem violações de acessibilidade (${theme})`, async ({ page }) => {
      const p = await de(6)
      await playUntilGrandFinal(p.draw.id)
      await useTheme(page, theme)

      await page.goto(`/t/${p.tournament.slug}`)
      await expect(page.getByRole('heading', { name: 'Chave dos perdedores' })).toBeVisible()
      await expect(page.getByText('Há reset')).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `eliminação dupla público [${theme}]`)

      await page.goto(`/admin/tournaments/${p.tournament.id}`)
      await page.getByRole('tab', { name: 'Chaveamento' }).click()
      await expect(page.getByRole('heading', { level: 3, name: 'Grande final' })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `eliminação dupla admin [${theme}]`)
    })
  }
})
