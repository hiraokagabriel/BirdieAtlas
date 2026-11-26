import { expect, test } from '@playwright/test'
import { createTournament } from '../support/factories.js'

// Datas sem hora (AAAA-MM-DD) não podem voltar um dia no fuso do Brasil: admin e público mostram o mesmo dia.
test.use({ timezoneId: 'America/Sao_Paulo' })

test('admin e página pública mostram as mesmas datas do torneio', async ({ page }) => {
  const tournament = await createTournament({ startDate: '2098-03-10', endDate: '2098-03-12' })

  await page.goto(`/admin/tournaments/${tournament.id}`)
  await expect(page.getByText('10/03/2098 – 12/03/2098')).toBeVisible()

  await page.goto(`/t/${tournament.slug}`)
  await expect(page.getByText('10/03/2098 – 12/03/2098')).toBeVisible()
})
