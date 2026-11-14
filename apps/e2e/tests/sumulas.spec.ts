import { expect, test } from '@playwright/test'
import { WEB_URL } from '../support/env.js'
import { createCategory, createTournament, prepareTournament, scheduleMatch, type PreparedTournament } from '../support/factories.js'

// Súmulas para imprimir (`/t/<slug>/sumulas`): uma por partida pronta para começar, por horário.
// E o QR code do telão para o público abrir a página do torneio (o caso localhost fica no teste unitário).

let prepared: PreparedTournament

function nameOf(registrationId: string | null): string {
  const found = prepared.registrations.find((r) => r.id === registrationId)
  if (!found?.athleteName) throw new Error(`Inscrição ${registrationId} sem nome de atleta.`)
  return found.athleteName
}

test('uma súmula por partida pronta, por horário, com quadra e tabela de sets', async ({ page }) => {
  prepared = await prepareTournament({ athleteCount: 4, name: `Súmulas E2E ${Date.now().toString(36)}` })
  const [semi1, semi2] = prepared.matches.filter((m) => m.round === 2).sort((a, b) => a.position - b.position)
  // A semifinal 2 joga antes: vem primeiro.
  await scheduleMatch(semi1!.id, 1, '2098-03-10T15:00:00.000Z')
  await scheduleMatch(semi2!.id, 2, '2098-03-10T13:00:00.000Z')

  await page.goto(`/t/${prepared.tournament.slug}/sumulas`)
  await expect(page.getByRole('heading', { level: 1, name: `Súmulas · ${prepared.tournament.name}` })).toBeVisible()
  const sheets = page.getByRole('article', { name: /^Súmula:/ })
  await expect(sheets).toHaveCount(2)
  await expect(sheets.first()).toHaveAccessibleName(`Súmula: ${nameOf(semi2!.registration1Id)} x ${nameOf(semi2!.registration2Id)}`)
  await expect(sheets.first()).toContainText('Quadra 2')
  await expect(sheets.first().getByRole('columnheader', { name: 'Set 3' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Imprimir/ })).toBeVisible()
})

test('sem partidas prontas: aviso de vazio e sem botão de imprimir', async ({ page }) => {
  const tournament = await createTournament({ status: 'registration_open' })
  await createCategory(tournament.id)
  await page.goto(`/t/${tournament.slug}/sumulas`)
  await expect(page.getByText(/Nenhuma partida pronta para começar/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Imprimir/ })).toHaveCount(0)
})

test('torneio inexistente: 404', async ({ page }) => {
  expect((await page.goto('/t/nao-existe-mesmo/sumulas'))?.status()).toBe(404)
})

test('telão mostra o QR code com o endereço da página do torneio', async ({ page }) => {
  const t = await prepareTournament({ athleteCount: 2 })
  await page.goto(`/telao/${t.tournament.slug}`)
  const qr = page.getByRole('figure', { name: /Acompanhe no celular/ })
  await expect(qr).toContainText(`${WEB_URL}/t/${t.tournament.slug}`)
  await expect(qr.locator('svg')).toBeVisible()
})
