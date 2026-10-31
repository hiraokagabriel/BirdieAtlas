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

// Grupos + eliminatória: configuração, fase de grupos, geração da eliminatória com os classificados,
// trava dos grupos, encerramento com colocação e as telas (admin e público).

interface GkoMatch {
  id: string
  round: number
  roundLabel: string | null
  groupKey: string | null
  stage: 'group' | 'knockout' | null
  status: string
  registration1Id: string | null
  registration2Id: string | null
}

interface GroupStandings {
  groups: { key: string; rows: { position: number; registrationId: string; wins: number }[] }[]
}

const matchesOf = (drawId: string) => api.get<GkoMatch[]>(`/draws/${drawId}/matches`)

async function prepared(athleteCount = 8) {
  return prepareTournament({ athleteCount, drawType: 'group_then_elimination', status: 'in_progress' })
}

test.describe('grupos + eliminatória (API)', () => {
  test('padrão: 8 inscritos viram 2 grupos de 4, todos contra todos em cada grupo', async () => {
    const p = await prepared()
    const matches = await matchesOf(p.draw.id)
    expect(matches).toHaveLength(12) // 2 grupos x 6 partidas
    expect(matches.every((m) => m.stage === 'group')).toBe(true)
    expect(new Set(matches.map((m) => m.groupKey))).toEqual(new Set(['A', 'B']))
    expect(matches.some((m) => m.roundLabel === 'Grupo A · Rodada 1')).toBe(true)
    expect(matches.every((m) => m.round > 2)).toBe(true) // acima das rodadas da eliminatória (4 classificados = 2 rodadas)
  })

  test('configuração personalizada: grupos, pessoas por grupo e classificados', async () => {
    const t = await createTournament({ status: 'in_progress' })
    const c = await createCategory(t.id, { drawType: 'group_then_elimination' })
    await registerApproved(c.id, await createAthletes(9, { gender: 'M' }))

    const bad = await apiCall<{ code: string; error: string }>('POST', `/draws/generate/${c.id}`, { mode: 'random', groupCount: 5 })
    expect(bad.status).toBe(422)
    expect(bad.body.code).toBe('INVALID_GROUP_CONFIG')
    expect(bad.body.error).toContain('máximo é 4 grupos')

    const tooMany = await apiCall<{ error: string }>('POST', `/draws/generate/${c.id}`, { mode: 'random', groupCount: 3, advancePerGroup: 3 })
    expect(tooMany.status).toBe(422)

    const ok = await api.post<{ draw: { id: string; config: { groupCount: number; advancePerGroup: number } }; matchCount: number }>(
      `/draws/generate/${c.id}`,
      { mode: 'random', groupSize: 3, advancePerGroup: 1 },
    )
    expect(ok.draw.config).toEqual({ groupCount: 3, advancePerGroup: 1 })
    expect(ok.matchCount).toBe(9) // 3 grupos de 3 pessoas: 3 partidas cada
  })

  test('eliminatória só depois dos grupos; encerrar exige a eliminatória; grupos travam; colocação final', async () => {
    const p = await prepared()
    const early = await apiCall<{ code: string }>('POST', `/draws/${p.draw.id}/knockout`)
    expect(early.status).toBe(409)
    expect(early.body.code).toBe('GROUPS_NOT_FINISHED')

    await playWholeDraw(p.draw.id)
    const standings = await api.get<GroupStandings>(`/draws/${p.draw.id}/standings`)
    expect(standings.groups.map((g) => g.key)).toEqual(['A', 'B'])
    expect(standings.groups.every((g) => g.rows.length === 4)).toBe(true)

    // Grupos terminados, sem eliminatória: não dá para encerrar nem distribuir pontos.
    const premature = await apiCall<{ code: string; details: { incomplete: string[] } }>('POST', `/tournaments/${p.tournament.id}/finalize`)
    expect(premature.status).toBe(400)
    expect(premature.body.details.incomplete[0]).toContain('eliminatória ainda não gerada')

    const created = await api.post<{ matchCount: number; qualifiers: number }>(`/draws/${p.draw.id}/knockout`)
    expect(created).toEqual({ matchCount: 3, qualifiers: 4 }) // 2 semifinais + final
    const again = await apiCall<{ code: string }>('POST', `/draws/${p.draw.id}/knockout`)
    expect(again.body.code).toBe('KNOCKOUT_ALREADY_GENERATED')

    // Os classificados são os dois primeiros de cada grupo.
    const all = await matchesOf(p.draw.id)
    const semis = all.filter((m) => m.stage === 'knockout' && m.round === 2)
    const inSemis = new Set(semis.flatMap((m) => [m.registration1Id, m.registration2Id]))
    const expected = standings.groups.flatMap((g) => g.rows.slice(0, 2).map((r) => r.registrationId))
    expect(inSemis).toEqual(new Set(expected))

    // Resultado de grupo não muda mais.
    const groupMatch = all.find((m) => m.stage === 'group')!
    const locked = await apiCall<{ code: string }>('POST', `/draws/matches/${groupMatch.id}/result`, {
      sets: [{ setNumber: 1, score1: 21, score2: 0 }, { setNumber: 2, score1: 21, score2: 0 }],
      status: 'completed',
    })
    expect(locked.status).toBe(409)
    expect(locked.body.code).toBe('GROUPS_LOCKED')

    await playWholeDraw(p.draw.id)
    await finalizeTournament(p.tournament.id)
    const regs = await api.get<{ finalPlacement: number | null }[]>(`/tournaments/categories/${p.category.id}/registrations`)
    // Campeão, vice, dois semifinalistas (3º) e quatro eliminados nos grupos (5º: como quem cai nas quartas de uma chave de 8).
    expect(regs.map((r) => r.finalPlacement).sort()).toEqual([1, 2, 3, 3, 5, 5, 5, 5])
  })

  test('refazer a chave apaga a eliminatória e permite nova configuração', async () => {
    const p = await prepared()
    await playWholeDraw(p.draw.id)
    await api.post(`/draws/${p.draw.id}/knockout`)
    await api.post(`/draws/${p.draw.id}/unpublish`) // chave publicada não é ressorteada
    const res = await api.post<{ matchCount: number }>(`/draws/${p.draw.id}/redraw`, { mode: 'random', groupCount: 4, advancePerGroup: 1 })
    expect(res.matchCount).toBe(4) // 4 grupos de 2: 1 partida cada
    const after = await matchesOf(p.draw.id)
    expect(after.every((m) => m.stage === 'group' && m.status === 'pending')).toBe(true)
  })
})

test.describe('grupos + eliminatória (interface)', () => {
  test('o admin configura os grupos, sorteia, termina os grupos e gera a eliminatória', async ({ page }) => {
    const tag = uniqueTag()
    const tournament = await createTournament({ status: 'in_progress', name: `GKO UI ${tag}` })
    const category = await createCategory(tournament.id, { drawType: 'group_then_elimination', name: `Grupos ${tag}` })
    await registerApproved(category.id, await createAthletes(8, { gender: 'M', prefix: 'GKOUI' }))

    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await page.getByLabel('Número de grupos').fill('9') // inválido para 8 inscritos
    await page.getByRole('button', { name: 'Sortear chave' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'máximo é 4 grupos' })).toBeVisible()

    await page.getByLabel('Número de grupos').fill('2')
    await page.getByLabel('Classificados por grupo').fill('2')
    await page.getByRole('button', { name: 'Sortear chave' }).click()
    await expect(page.getByRole('heading', { name: 'Grupo A' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Grupo B' })).toBeVisible()
    await expect(page.getByRole('region', { name: /^Classificação do Grupo A/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gerar eliminatória' })).toBeDisabled()

    const drawId = (await api.get<{ id: string }[]>(`/tournaments/categories/${category.id}/draws`))[0]!.id
    await playWholeDraw(drawId)
    await page.reload()
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await page.getByRole('button', { name: 'Gerar eliminatória' }).click()
    await expect(page.getByRole('region', { name: /^Chave de/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gerar eliminatória' })).toHaveCount(0)
  })

  test('o formato "Grupos + eliminatória" aparece no cadastro de categorias', async ({ page }) => {
    const tournament = await createTournament({ status: 'draft' })
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('tab', { name: 'Configurações' }).click()
    await page.getByLabel('Formato').selectOption('group_then_elimination')
    await page.getByLabel('Nome da categoria').fill('Fase de grupos e mata-mata')
    await page.getByRole('button', { name: 'Criar categoria' }).click()
    await expect(page.getByText('· grupos + eliminatória')).toBeVisible()
  })

  for (const theme of THEMES) {
    test(`portal e admin sem violações de acessibilidade (${theme})`, async ({ page }) => {
      const p = await prepared()
      await playWholeDraw(p.draw.id)
      await api.post(`/draws/${p.draw.id}/knockout`)
      await useTheme(page, theme)

      await page.goto(`/t/${p.tournament.slug}`)
      await expect(page.getByRole('heading', { name: 'Grupo A' })).toBeVisible()
      await expect(page.getByRole('region', { name: /^Chave de/ })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `grupos + eliminatória público [${theme}]`)

      await page.goto(`/admin/tournaments/${p.tournament.id}`)
      await page.getByRole('tab', { name: 'Chaveamento' }).click()
      await expect(page.getByRole('heading', { name: 'Grupo A' })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `grupos + eliminatória admin [${theme}]`)
    })
  }
})

