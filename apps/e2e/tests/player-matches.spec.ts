import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { createCategory, createTournament, generateDraw, listMatches, publishDraw, uniqueTag } from '../support/factories.js'

// "Encontre sua próxima partida": busca do jogador na página do torneio e a página das partidas dele,
// com o bye (avança direto) e a próxima se vencer.

type Reg = { id: string; athleteId: string | null; athleteName: string | null }
type PlayerMatch = { matchId: string; kind: string; roundLabel: string; opponent: string | null; ifWin: { roundLabel: string; opponent: string } | null }

test('o jogador com bye acha as partidas pela busca do torneio', async ({ page }) => {
  const tag = uniqueTag()
  const tournament = await createTournament({ name: `Amistoso Partidas ${tag}`, kind: 'friendly', status: 'registration_open' })
  const category = await createCategory(tournament.id, { name: 'Simples Masculino', discipline: 'MS' })
  // 6 inscritos numa chave de 8: dois byes nas quartas.
  const names = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco', 'Foxtrote'].map((n) => `${n} Jogador ${tag}`)
  await api.post(`/tournaments/categories/${category.id}/guests`, { text: names.join('\n') })
  const draw = await generateDraw(category.id)

  const matches = await listMatches(draw.id)
  const bye = matches.find((m) => m.status === 'walkover' && (m.registration1Id === null || m.registration2Id === null))!
  const regs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${tournament.id}?pageSize=100`)).data
  const byeReg = regs.find((r) => r.id === (bye.registration1Id ?? bye.registration2Id))!

  // Sorteio provisório não sai no público.
  const draft = await api.get<{ matches: PlayerMatch[]; nextMatchId: string | null }>(`/tournaments/${tournament.id}/players/${byeReg.athleteId}/matches`)
  expect(draft).toMatchObject({ matches: [], nextMatchId: null })
  await publishDraw(draw.id)
  const name = byeReg.athleteName!

  // API: busca (só inscritos do torneio) e partidas com o bye e a semifinal.
  const search = await api.get<{ data: { athleteId: string; name: string; categories: string[] }[] }>(`/tournaments/${tournament.id}/players?q=${encodeURIComponent(name.split(' ')[0]!)}`)
  expect(search.data).toEqual([{ athleteId: byeReg.athleteId, name, categories: ['Simples Masculino'] }])
  const schedule = await api.get<{ matches: PlayerMatch[]; nextMatchId: string | null }>(`/tournaments/${tournament.id}/players/${byeReg.athleteId}/matches`)
  expect(schedule.matches[0]).toMatchObject({ kind: 'bye', roundLabel: 'Quartas de final', opponent: null })
  expect(schedule.matches[1]).toMatchObject({ kind: 'upcoming', roundLabel: 'Semifinal', ifWin: { roundLabel: 'Final' } })
  expect(schedule.nextMatchId).toBe(schedule.matches[1]!.matchId)
  expect((await apiCall('GET', `/tournaments/${tournament.id}/players/00000000-0000-0000-0000-000000000000/matches`)).status).toBe(404)

  // Tela: busca no torneio, abre o jogador, vê o bye e a próxima partida em destaque.
  await page.goto(`/t/${tournament.slug}`)
  await page.getByRole('searchbox', { name: 'Encontre sua próxima partida' }).fill(name)
  await page.getByRole('region', { name: 'Encontre sua próxima partida' }).getByRole('link', { name: new RegExp(name) }).click()
  await expect(page).toHaveURL(new RegExp(`/t/${tournament.slug}/jogador/${byeReg.athleteId}$`))
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByText('Avança direto para a fase seguinte, sem jogar.')).toBeVisible()
  const next = page.getByRole('region', { name: 'Próxima partida' })
  await expect(next).toContainText('Semifinal')
  await expect(next).toContainText(/Se vencer: Final contra/)
})
