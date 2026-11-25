import { expect, test } from '@playwright/test'
import { api } from '../support/api.js'
import {
  createAthletes,
  createCategory,
  createTournament,
  prepareTournament,
  scheduleMatch,
  uniqueTag,
  type PreparedTournament,
} from '../support/factories.js'

// Painel do admin (`/admin`): "Precisa de você" (GET /dashboard/attention) e "Quadras" (ao vivo + fila do torneio).

type AttentionItem = { kind: string; tournamentId: string; tournamentName: string; count: number }

test('"Precisa de você" mostra as inscrições pendentes do torneio e leva a ele', async ({ page }) => {
  // Data antiga: o torneio fica entre os primeiros da lista (ordenada por início), sempre visível no painel.
  const tournament = await createTournament({
    name: `Pendências E2E ${uniqueTag()}`,
    status: 'registration_open',
    startDate: '2001-01-01',
    endDate: '2001-01-02',
  })
  const category = await createCategory(tournament.id)
  for (const athlete of await createAthletes(2, { gender: 'M' })) {
    await api.post(`/tournaments/categories/${category.id}/register`, { athleteId: athlete.id })
  }

  const attention = await api.get<{ liveMatches: number; items: AttentionItem[] }>('/dashboard/attention')
  expect(attention.items).toContainEqual({ kind: 'pending_registrations', tournamentId: tournament.id, tournamentName: tournament.name, count: 2 })
  // Inscrições abertas: ainda não cobra chave.
  expect(attention.items.filter((i) => i.tournamentId === tournament.id)).toHaveLength(1)

  await page.goto('/admin')
  const panel = page.getByRole('region', { name: 'Precisa de você' })
  const review = panel.getByRole('link', { name: new RegExp(`^Revisar 2 inscrições aguardando aprovação, ${tournament.name}$`) })
  await expect(review).toHaveAttribute('href', `/admin/tournaments/${tournament.id}`)
})

test.describe('Quadras', () => {
  let prepared: PreparedTournament

  test.beforeEach(async () => {
    prepared = await prepareTournament({ athleteCount: 4, name: `Quadras E2E ${uniqueTag()}` })
    const semis = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
    await scheduleMatch(semis[0]!.id, 1, '2098-03-10T12:00:00.000Z')
    await scheduleMatch(semis[1]!.id, 2, '2098-03-10T13:30:00.000Z')
    await api.post(`/draws/matches/${semis[0]!.id}/live/start`, { courtNumber: 1 })
  })

  test('mostra a partida em quadra, a quadra livre com a próxima e chama a partida no Ao vivo', async ({ page }) => {
    const semis = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
    const nameOf = (id: string | null) => prepared.registrations.find((r) => r.id === id)?.athleteName ?? '?'

    await page.goto('/admin')
    const panel = page.getByRole('region', { name: 'Quadras' })
    // Com mais de um torneio em andamento, o painel pede para escolher; espera carregar antes de decidir.
    const picker = panel.getByLabel('Torneio')
    await expect(panel.getByRole('status')).toHaveCount(0)
    await expect(panel.getByRole('listitem').or(picker).first()).toBeVisible()
    if (await picker.isVisible()) await picker.selectOption({ label: prepared.tournament.name })

    const court1 = panel.getByRole('listitem').filter({ hasText: 'Quadra 1' })
    await expect(court1).toContainText(nameOf(semis[0]!.registration1Id))
    await expect(court1).toContainText(nameOf(semis[0]!.registration2Id))
    await expect(court1).toContainText('Ao vivo')

    const court2 = panel.getByRole('listitem').filter({ hasText: 'Quadra 2' })
    await expect(court2).toContainText('Livre')
    await expect(court2).toContainText(nameOf(semis[1]!.registration1Id))
    await expect(court2).toContainText(nameOf(semis[1]!.registration2Id))

    // O contador amarelo do menu conta as partidas ao vivo (esta e as de outros testes).
    await expect(page.getByRole('navigation', { name: 'Navegação administrativa' }).first().getByRole('link', { name: /^Ao vivo \d+ partidas? ao vivo$/ })).toBeVisible()

    await court2.getByRole('link', { name: 'Chamar partida na quadra 2' }).click()
    await expect(page).toHaveURL(/\/admin\/live$/)
    await expect(page.getByLabel('Torneio')).toHaveValue(prepared.tournament.id)
    await expect(page.getByRole('button', { name: /^Quadra 2/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
