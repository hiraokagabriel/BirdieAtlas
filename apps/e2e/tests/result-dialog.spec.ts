import { expect, test } from '@playwright/test'
import { api } from '../support/api.js'
import { prepareTournament, uniqueTag, type PreparedTournament } from '../support/factories.js'

// Diálogo de resultado: partida decidida no 3º set (1 × 1 nos dois primeiros), o veredito antes de salvar
// e o Enter salvando pelo formulário.

let prepared: PreparedTournament

test.beforeEach(async () => {
  prepared = await prepareTournament({ athleteCount: 4, name: `Resultado E2E ${uniqueTag()}` })
})

test('lança uma partida de 3 sets com Enter e mostra o vencedor antes de salvar', async ({ page }) => {
  await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
  await page.getByRole('tab', { name: 'Chaveamento' }).click()
  await page.getByRole('button', { name: /^(?!.*vencedor).*Abrir resultado/ }).first().click()

  const dialog = page.getByRole('dialog', { name: 'Lançar resultado' })
  const scores = dialog.getByRole('spinbutton')
  await expect(scores).toHaveCount(4) // o 3º set só abre com 1 × 1
  await scores.nth(0).fill('21')
  await scores.nth(1).fill('15')
  await scores.nth(2).fill('19')
  await scores.nth(3).fill('21')
  await expect(scores).toHaveCount(6)

  await scores.nth(4).fill('21')
  await scores.nth(5).fill('18')
  await expect(dialog.getByRole('status')).toHaveText(/^Vitória de .+ por 2 sets a 1$/)

  await scores.nth(5).press('Enter')
  await expect(dialog).toBeHidden()

  const semis = prepared.matches.filter((m) => m.round === 2)
  const results = await Promise.all(semis.map((m) => api.get<{ setNumber: number }[]>(`/draws/matches/${m.id}/result`)))
  expect(results.map((r) => r.length)).toContain(3)
})
