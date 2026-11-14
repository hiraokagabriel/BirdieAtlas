import { expect, test } from '@playwright/test'
import { api } from '../support/api.js'
import { prepareTournament, scheduleMatch, type LiveMatchView, type PreparedTournament } from '../support/factories.js'

// Telão (`/telao/<slug>`): página pública sem o layout do site, para TV ou projetor. Quadras com o placar
// ao vivo pelo stream SSE e a fila de próximas partidas.

let prepared: PreparedTournament

function nameOf(registrationId: string | null): string {
  const found = prepared.registrations.find((r) => r.id === registrationId)
  if (!found?.athleteName) throw new Error(`Inscrição ${registrationId} sem nome de atleta.`)
  return found.athleteName
}

test.beforeEach(async () => {
  // 4 atletas: semifinal 1 na quadra 1 (vai começar), semifinal 2 agendada na quadra 2.
  prepared = await prepareTournament({ athleteCount: 4, name: `Telão E2E ${Date.now().toString(36)}` })
  const semis = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
  await scheduleMatch(semis[0]!.id, 1, '2098-03-10T12:00:00.000Z')
  await scheduleMatch(semis[1]!.id, 2, '2098-03-10T13:30:00.000Z')
})

test('mostra quadras, placar ao vivo em tempo real e a fila; sem o cabeçalho do site', async ({ page }) => {
  const [semi1, semi2] = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
  const a = nameOf(semi1!.registration1Id)
  const b = nameOf(semi1!.registration2Id)
  const c = nameOf(semi2!.registration1Id)
  const d = nameOf(semi2!.registration2Id)

  await page.goto(`/telao/${prepared.tournament.slug}`)
  await expect(page.getByRole('heading', { level: 1, name: prepared.tournament.name })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)

  // Antes de começar: as duas quadras livres com a próxima partida, e a fila com as duas.
  const court1 = page.getByRole('article', { name: /^Quadra 1:/ })
  await expect(court1).toContainText('Livre')
  await expect(court1).toContainText(`Próxima: ${a} × ${b}`)
  const queue = page.getByRole('region', { name: 'Próximas partidas' }).getByRole('listitem')
  await expect(queue).toHaveCount(2)

  // Começa a semifinal 1: a quadra 1 mostra a partida ao vivo e ela sai da fila.
  await api.post(`/draws/matches/${semi1!.id}/live/start`, { courtNumber: 1 })
  await expect(page.getByRole('article', { name: `Quadra 1: ${a} x ${b}` })).toBeVisible()
  await expect(queue).toHaveCount(1)
  await expect(queue.first()).toContainText(`${c} × ${d}`)

  // Um ponto chega pelo stream, sem recarregar.
  const [live] = await api.get<LiveMatchView[]>(`/tournaments/${prepared.tournament.id}/live/matches`)
  await api.post(`/draws/matches/${semi1!.id}/live/point`, { side: 1, version: live!.version })
  await expect(page.getByRole('article', { name: `Quadra 1: ${a} x ${b}` }).getByText('1', { exact: true })).toBeVisible()

  // A quadra 2 continua livre, com a próxima.
  await expect(page.getByRole('article', { name: /^Quadra 2:/ })).toContainText(`Próxima: ${c} × ${d}`)
})

test('torneio inexistente responde com a página de não encontrado', async ({ page }) => {
  const res = await page.goto('/telao/nao-existe-mesmo')
  expect(res?.status()).toBe(404)
})
