import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { createCategory, createTournament, generateDraw, listLiveMatches, listMatches, publishDraw, transition, uniqueTag } from '../support/factories.js'

// "Encontre sua próxima partida": busca do jogador na página do torneio e a página das partidas dele,
// com o bye (avança direto) e a próxima se vencer.

type Reg = { id: string; athleteId: string | null; athleteName: string | null }
type PlayerMatch = { matchId: string; kind: string; roundLabel: string; opponent: string | null; ifWin: { roundLabel: string; opponent: string | null } | null }

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
  await expect(next).toContainText('Se vencer: Final')
  // A fase do "Se vencer" leva ao chaveamento da categoria.
  await next.getByRole('link', { name: /^Final \(ver o chaveamento de Simples Masculino\)$/ }).click()
  await expect(page).toHaveURL(new RegExp(`/t/${tournament.slug}[?]categoria=${category.id}$`))
  await expect(page.getByRole('tab', { name: 'Chaveamento', selected: true })).toBeVisible()
})

test('partida ao vivo mostra o placar corrente do ponto de vista do jogador', async ({ page }) => {
  const tag = uniqueTag()
  const tournament = await createTournament({ name: `Amistoso Ao Vivo ${tag}`, kind: 'friendly', status: 'registration_open' })
  const category = await createCategory(tournament.id, { name: 'Simples Feminino', discipline: 'WS' })
  await api.post(`/tournaments/categories/${category.id}/guests`, { text: [`Ana Viva ${tag}`, `Bia Viva ${tag}`].join('\n') })
  await transition(tournament.id, 'registration_closed')
  const draw = await generateDraw(category.id)
  await publishDraw(draw.id)
  await transition(tournament.id, 'in_progress')

  const [match] = await listMatches(draw.id)
  await api.post(`/draws/matches/${match!.id}/live/start`, { courtNumber: 2 })
  // Lado 2 faz 2 pontos, lado 1 faz 1.
  for (const side of [2, 2, 1] as const) {
    const live = (await listLiveMatches(tournament.id)).find((m) => m.matchId === match!.id)!
    await api.post(`/draws/matches/${match!.id}/live/point`, { side, version: live.version })
  }
  const regs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${tournament.id}?pageSize=100`)).data
  const side2 = regs.find((r) => r.id === match!.registration2Id)!

  const schedule = await api.get<{ matches: (PlayerMatch & { score: string | null })[] }>(`/tournaments/${tournament.id}/players/${side2.athleteId}/matches`)
  expect(schedule.matches[0]).toMatchObject({ kind: 'live', score: '2-1' })

  await page.goto(`/t/${tournament.slug}/jogador/${side2.athleteId}`)
  const next = page.getByRole('region', { name: 'Jogando agora' })
  await expect(next).toContainText('2-1')
  // Simples: o adversário leva ao confronto direto dos dois; a fase, ao chaveamento.
  const side1 = regs.find((r) => r.id === match!.registration1Id)!
  await expect(next.getByRole('link', { name: `${side1.athleteName} (confronto direto)` })).toHaveAttribute('href', `/a/${side2.athleteId}/vs/${side1.athleteId}`)
  await expect(next.getByRole('link', { name: /\(ver o chaveamento\)$/ })).toHaveAttribute('href', `/t/${tournament.slug}?categoria=${category.id}`)
})

test('a página do jogador abre pelos Inscritos, pelo perfil do atleta e pelo admin', async ({ page }) => {
  const tag = uniqueTag()
  const tournament = await createTournament({ name: `Amistoso Links ${tag}`, kind: 'friendly', status: 'registration_open' })
  const category = await createCategory(tournament.id, { name: 'Simples Masculino', discipline: 'MS' })
  const name = `Davi Links ${tag}`
  await api.post(`/tournaments/categories/${category.id}/guests`, { text: [name, `Edu Links ${tag}`].join('\n') })
  const regs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${tournament.id}?pageSize=100`)).data
  const athleteId = regs.find((r) => r.athleteName === name)!.athleteId!
  // Inscrições abertas: o torneio ainda não aparece no perfil.
  expect((await api.get<{ data: unknown[] }>(`/athletes/${athleteId}/upcoming-matches`)).data).toEqual([])
  await transition(tournament.id, 'registration_closed')
  await publishDraw((await generateDraw(category.id)).id)
  const playerUrl = new RegExp(`/t/${tournament.slug}/jogador/${athleteId}$`)

  // API do perfil: a próxima partida neste torneio.
  const upcoming = await api.get<{ data: { tournament: { slug: string }; matches: { kind: string; opponent: string | null }[] }[] }>(`/athletes/${athleteId}/upcoming-matches`)
  expect(upcoming.data).toEqual([expect.objectContaining({ tournament: expect.objectContaining({ slug: tournament.slug }), matches: [expect.objectContaining({ kind: 'upcoming', opponent: `Edu Links ${tag}` })] })])

  // Torneio › Inscritos: o nome é link.
  await page.goto(`/t/${tournament.slug}`)
  await page.getByRole('tab', { name: 'Inscritos' }).click()
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page).toHaveURL(playerUrl)

  // Perfil público: bloco Próximas partidas.
  await page.goto(`/a/${athleteId}`)
  const section = page.getByRole('region', { name: 'Próximas partidas' })
  await expect(section).toContainText(`Edu Links ${tag}`)
  // As partidas ficam no próprio perfil; o nome do torneio leva à página do torneio.
  await expect(section).toContainText('Próxima')
  await expect(section).toContainText('Simples Masculino · Final')
  await expect(section.getByRole('link', { name: `Amistoso Links ${tag}` })).toHaveAttribute('href', `/t/${tournament.slug}`)

  // Admin › Inscrições: "Ver partidas" aponta para a mesma página.
  await page.goto(`/admin/tournaments/${tournament.id}`)
  await page.getByRole('tab', { name: /Inscrições/ }).click()
  await expect(page.getByRole('link', { name: `Ver partidas de ${name} (abre em nova aba)` })).toHaveAttribute('href', `/t/${tournament.slug}/jogador/${athleteId}`)
})
