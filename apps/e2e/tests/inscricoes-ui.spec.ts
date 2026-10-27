import { expect, test } from '@playwright/test'
import { api } from '../support/api.js'
import {
  createAthlete,
  createCategory,
  createTournament,
  uniqueTag,
  type Athlete,
  type Category,
  type Tournament,
} from '../support/factories.js'

// Inscrições pela interface (aba Inscrições do torneio): inscrever, aprovar, recusar com motivo, reabrir e
// remover. O torneio, a categoria e os atletas vêm da API; o estado final é conferido pela API.

interface RegistrationRow {
  id: string
  athleteId: string
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
}

let tournament: Tournament
let category: Category

test.beforeAll(async () => {
  tournament = await createTournament({ status: 'registration_open', name: `Inscrições UI ${uniqueTag()}` })
  category = await createCategory(tournament.id)
})

async function openRegistrations(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`/admin/tournaments/${tournament.id}`)
  await expect(page.getByRole('heading', { name: tournament.name })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Inscrições' })).toHaveAttribute('aria-selected', 'true')
}

async function adminRegistrations(): Promise<RegistrationRow[]> {
  const res = await api.get<{ data: RegistrationRow[] }>(`/registrations/tournament/${tournament.id}`)
  return res.data
}

/** Inscreve o atleta pelo formulário da aba (busca pelo nome e escolhe no select). */
async function registerThroughForm(page: import('@playwright/test').Page, athlete: Athlete): Promise<void> {
  await page.getByRole('button', { name: 'Inscrever' }).click()
  await page.getByLabel('Buscar atleta').fill(athlete.name)
  await page.getByLabel(/^Atleta/).selectOption({ label: athlete.name })
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click()
}

test.describe.configure({ mode: 'serial' })

test('inscreve um atleta pelo formulário e ele aparece como pendente', async ({ page }) => {
  const athlete = await createAthlete({ name: `Inscrito UI ${uniqueTag()}`, gender: 'M' })
  await openRegistrations(page)
  await registerThroughForm(page, athlete)

  await expect(page.getByRole('button', { name: `Aprovar inscrição de ${athlete.name}` })).toBeVisible()
  const row = (await adminRegistrations()).find((r) => r.athleteId === athlete.id)
  expect(row?.status).toBe('pending')
})

test('aprova uma inscrição pendente', async ({ page }) => {
  const athlete = await createAthlete({ name: `Aprovado UI ${uniqueTag()}`, gender: 'M' })
  await api.post(`/tournaments/categories/${category.id}/register`, { athleteId: athlete.id })
  await openRegistrations(page)

  await page.getByRole('button', { name: `Aprovar inscrição de ${athlete.name}` }).click()
  await expect(page.getByRole('button', { name: `Aprovar inscrição de ${athlete.name}` })).toBeHidden()
  const row = (await adminRegistrations()).find((r) => r.athleteId === athlete.id)
  expect(row?.status).toBe('approved')
})

test('recusa com motivo, mostra o motivo e reabre a inscrição', async ({ page }) => {
  const athlete = await createAthlete({ name: `Recusado UI ${uniqueTag()}`, gender: 'M' })
  await api.post(`/tournaments/categories/${category.id}/register`, { athleteId: athlete.id })
  await openRegistrations(page)

  await page.getByRole('button', { name: `Recusar inscrição de ${athlete.name}` }).click()
  const reason = page.getByLabel('Motivo da recusa')
  const submit = page.getByRole('button', { name: 'Recusar', exact: true })
  await expect(submit).toBeDisabled()
  await reason.fill('Documentação incompleta')
  await submit.click()

  await expect(page.getByText('Motivo: Documentação incompleta')).toBeVisible()
  let row = (await adminRegistrations()).find((r) => r.athleteId === athlete.id)
  expect(row?.status).toBe('rejected')
  expect(row?.notes).toBe('Documentação incompleta')

  await page.getByRole('button', { name: `Reabrir inscrição de ${athlete.name}` }).click()
  await expect(page.getByRole('button', { name: `Aprovar inscrição de ${athlete.name}` })).toBeVisible()
  row = (await adminRegistrations()).find((r) => r.athleteId === athlete.id)
  expect(row?.status).toBe('pending')
})

test('remove uma inscrição', async ({ page }) => {
  const athlete = await createAthlete({ name: `Removido UI ${uniqueTag()}`, gender: 'M' })
  await api.post(`/tournaments/categories/${category.id}/register`, { athleteId: athlete.id })
  await openRegistrations(page)

  await page.getByRole('button', { name: `Remover inscrição de ${athlete.name}` }).click()
  await expect(page.getByRole('button', { name: `Remover inscrição de ${athlete.name}` })).toBeHidden()
  expect((await adminRegistrations()).some((r) => r.athleteId === athlete.id)).toBe(false)
})

test('atleta já inscrito na categoria não aparece mais para escolher', async ({ page }) => {
  const athlete = await createAthlete({ name: `Duplicado UI ${uniqueTag()}`, gender: 'M' })
  await api.post(`/tournaments/categories/${category.id}/register`, { athleteId: athlete.id })
  await openRegistrations(page)

  await page.getByRole('button', { name: 'Inscrever' }).click()
  await page.getByLabel('Buscar atleta').fill(athlete.name)
  await expect(page.getByText('Nenhum atleta disponível para esta categoria.')).toBeVisible()
})
