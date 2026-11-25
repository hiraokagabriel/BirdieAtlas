import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { prepareTournament, scoreUntilDecided } from '../support/factories.js'

// Histórico de resultados: cada gravação oficial guarda o antes e o depois, a origem (diálogo do admin ou
// quadra ao vivo) e quantas partidas seguintes foram desfeitas. Leitura só de admin.

interface ResultEvent {
  source: 'dialog' | 'live' | 'cascade'
  courtNumber: number | null
  previousStatus: string
  previousSets: { setNumber: number; score1: number; score2: number }[]
  nextStatus: string
  nextSets: { setNumber: number; score1: number; score2: number }[]
  resetMatchCount: number
  createdAt: string
}

const sets = (a: [number, number][]) => a.map(([score1, score2], i) => ({ setNumber: i + 1, score1, score2 }))
const history = (matchId: string) => api.get<ResultEvent[]>(`/draws/matches/${matchId}/result-history`)

test('diálogo: primeiro resultado e correção que troca o vencedor ficam no histórico, mais recente primeiro', async () => {
  const prepared = await prepareTournament({ athleteCount: 4 })
  const [semi] = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
  expect(await history(semi!.id)).toEqual([])

  await api.post(`/draws/matches/${semi!.id}/result`, { status: 'completed', sets: sets([[21, 15], [21, 18]]) })
  await api.post(`/draws/matches/${semi!.id}/result`, { status: 'completed', sets: sets([[15, 21], [18, 21]]) })

  const events = await history(semi!.id)
  expect(events).toHaveLength(2)
  // A final ainda não tinha resultado: só o slot mudou, nada foi desfeito.
  expect(events[0]).toMatchObject({ source: 'dialog', previousStatus: 'completed', previousSets: sets([[21, 15], [21, 18]]), nextSets: sets([[15, 21], [18, 21]]), resetMatchCount: 0 })
  expect(events[1]).toMatchObject({ source: 'dialog', previousStatus: 'pending', previousSets: [], nextStatus: 'completed' })
  expect(Date.parse(events[0]!.createdAt)).toBeGreaterThanOrEqual(Date.parse(events[1]!.createdAt))
})

test('trocar o vencedor desfaz o resultado da final, que ganha um evento de cascata', async () => {
  const prepared = await prepareTournament({ athleteCount: 4 })
  const [semi1, semi2] = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
  const final = prepared.matches.find((m) => m.round === 1)!
  await api.post(`/draws/matches/${semi1!.id}/result`, { status: 'completed', sets: sets([[21, 15], [21, 18]]) })
  await api.post(`/draws/matches/${semi2!.id}/result`, { status: 'completed', sets: sets([[21, 15], [21, 18]]) })
  await api.post(`/draws/matches/${final.id}/result`, { status: 'completed', sets: sets([[21, 5], [21, 6]]) })

  await api.post(`/draws/matches/${semi1!.id}/result`, { status: 'completed', sets: sets([[15, 21], [18, 21]]) })
  expect((await history(semi1!.id))[0]).toMatchObject({ resetMatchCount: 1 })
  const [cascade] = await history(final.id)
  expect(cascade).toMatchObject({ source: 'cascade', previousStatus: 'completed', previousSets: sets([[21, 5], [21, 6]]), nextStatus: 'pending', nextSets: [] })
})

test('encerramento ao vivo registra a quadra', async () => {
  const prepared = await prepareTournament({ athleteCount: 2 })
  const [match] = prepared.matches
  await api.post(`/draws/matches/${match!.id}/live/start`, { courtNumber: 4 })
  const decided = await scoreUntilDecided(prepared.tournament.id, match!.id, 1)
  await api.post(`/draws/matches/${match!.id}/live/finish`, { version: decided.version })
  const [event] = await history(match!.id)
  expect(event).toMatchObject({ source: 'live', courtNumber: 4, previousStatus: 'in_progress', nextStatus: 'completed' })
})

test('partida inexistente: 404', async () => {
  expect((await apiCall('GET', '/draws/matches/nao-existe/result-history')).status).toBe(404)
})

test('no diálogo de resultado, o histórico mostra a correção', async ({ page }) => {
  const prepared = await prepareTournament({ athleteCount: 2 })
  const [match] = prepared.matches
  await api.post(`/draws/matches/${match!.id}/result`, { status: 'completed', sets: sets([[21, 10], [21, 11]]) })
  await api.post(`/draws/matches/${match!.id}/result`, { status: 'completed', sets: sets([[21, 10], [21, 12]]) })

  await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
  await page.getByRole('tab', { name: 'Chaveamento', exact: true }).click()
  await page.getByRole('button', { name: /Abrir resultado/ }).first().click()
  const dialog = page.getByRole('dialog', { name: /Editar resultado/ })
  await dialog.getByText('Histórico de alterações (2)').click()
  await expect(dialog.getByText('De 21-10 21-11 para')).toBeVisible()
  await expect(dialog.getByText('Diálogo de resultado').first()).toBeVisible()
})
