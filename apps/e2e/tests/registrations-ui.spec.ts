import { expect, test, type Page } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { affiliate, createAthlete, createCategory, createClub, createTournament, uniqueTag, type Athlete } from '../support/factories.js'

// Inscrições pela interface (aba Inscrições do torneio): inscrever, aprovar, recusar com motivo,
// reabrir, remover e as recusas de elegibilidade da API. Atletas, torneio e categoria vêm da API.

interface RegistrationRow {
  athleteId: string
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
}

async function enroll(page: Page, athlete: Athlete): Promise<void> {
  await page.getByRole('button', { name: 'Inscrever' }).click()
  await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill(athlete.name)
  const select = page.getByRole('combobox', { name: /^Atleta/ })
  await expect(select.getByRole('option', { name: athlete.name })).toHaveCount(1)
  await select.selectOption(athlete.id)
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click()
}

/** Lista de admin: inclui as recusadas, que a lista pública omite. */
async function listRegistrations(tournamentId: string): Promise<RegistrationRow[]> {
  return (await api.get<{ data: RegistrationRow[] }>(`/registrations/tournament/${tournamentId}`)).data
}

test.describe('inscrições pela interface', () => {
  test('inscreve (pendente), aprova, recusa com motivo, reabre e remove', async ({ page }) => {
    const tournament = await createTournament({ status: 'registration_open' })
    await createCategory(tournament.id)
    const tag = uniqueTag()
    const first = await createAthlete({ name: `Inscrito Um ${tag}`, gender: 'M' })
    const second = await createAthlete({ name: `Inscrito Dois ${tag}`, gender: 'M' })

    await page.goto(`/admin/tournaments/${tournament.id}`)
    await enroll(page, first)
    await expect(page.getByRole('button', { name: `Aprovar inscrição de ${first.name}` })).toBeVisible()

    await page.getByRole('button', { name: `Aprovar inscrição de ${first.name}` }).click()
    await expect(page.getByRole('button', { name: `Aprovar inscrição de ${first.name}` })).toHaveCount(0)
    expect((await listRegistrations(tournament.id)).find((r) => r.athleteId === first.id)?.status).toBe('approved')

    await enroll(page, second)
    await page.getByRole('button', { name: `Recusar inscrição de ${second.name}` }).click()
    const reason = page.getByRole('textbox', { name: 'Motivo da recusa' })
    await expect(page.getByRole('button', { name: 'Recusar', exact: true })).toBeDisabled()
    await reason.fill('Documentação pendente')
    await page.getByRole('button', { name: 'Recusar', exact: true }).click()
    await expect(page.getByRole('button', { name: `Reabrir inscrição de ${second.name}` })).toBeVisible()

    const rejected = (await listRegistrations(tournament.id)).find((r) => r.athleteId === second.id)
    expect(rejected?.status).toBe('rejected')

    await page.getByRole('button', { name: `Reabrir inscrição de ${second.name}` }).click()
    await expect(page.getByRole('button', { name: `Aprovar inscrição de ${second.name}` })).toBeVisible()

    await page.getByRole('button', { name: `Remover inscrição de ${second.name}` }).click()
    await expect(page.getByRole('button', { name: `Aprovar inscrição de ${second.name}` })).toHaveCount(0)
    expect((await listRegistrations(tournament.id)).some((r) => r.athleteId === second.id)).toBe(false)
  })

  test('a lista de atletas já exclui gênero incompatível e quem já está inscrito', async ({ page }) => {
    const tournament = await createTournament({ status: 'registration_open' })
    await createCategory(tournament.id)
    const tag = uniqueTag()
    const woman = await createAthlete({ name: `Atleta Feminina ${tag}`, gender: 'F' })
    const man = await createAthlete({ name: `Atleta Masculino ${tag}`, gender: 'M' })

    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('button', { name: 'Inscrever' }).click()
    await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill(tag)
    const select = page.getByRole('combobox', { name: /^Atleta/ })
    await expect(select.getByRole('option', { name: man.name })).toHaveCount(1)
    await expect(select.getByRole('option', { name: woman.name })).toHaveCount(0)

    await select.selectOption(man.id)
    await page.getByRole('button', { name: 'Confirmar inscrição' }).click()
    await expect(page.getByRole('button', { name: `Aprovar inscrição de ${man.name}` })).toBeVisible()

    await page.getByRole('button', { name: 'Inscrever' }).click()
    await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill(tag)
    await expect(page.getByText('Nenhum atleta disponível para esta categoria.')).toBeVisible()
  })

  test('a API recusa gênero incompatível mesmo fora da interface', async () => {
    const tournament = await createTournament({ status: 'registration_open' })
    const category = await createCategory(tournament.id)
    const woman = await createAthlete({ gender: 'F' })
    const res = await apiCall('POST', `/tournaments/categories/${category.id}/register`, { athleteId: woman.id })
    expect(res.status).toBe(422)
    expect((res.body as { code?: string }).code).toBe('GENDER_INCOMPATIBLE')
  })

  test('torneio cancelado bloqueia novas inscrições na interface', async ({ page }) => {
    const tournament = await createTournament({ status: 'registration_open' })
    await createCategory(tournament.id)
    await api.post(`/tournaments/${tournament.id}/transition`, { to: 'cancelled' })
    await page.goto(`/admin/tournaments/${tournament.id}`)
    await expect(page.getByText('Torneio encerrado: inscrições bloqueadas')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Inscrever' })).toHaveCount(0)
  })

  test('o seletor mostra o clube de cada atleta e diferencia nomes iguais', async ({ page }) => {
    const tournament = await createTournament({ status: 'registration_open' })
    await createCategory(tournament.id)
    const tag = uniqueTag()
    const name = `Homônimo ${tag}`
    const club = await createClub({ name: `Clube Seletor ${tag}` })
    const withClub = await createAthlete({ name, gender: 'M' })
    const withoutClub = await createAthlete({ name, gender: 'M' })
    await affiliate(withClub.id, club.id)

    await page.goto(`/admin/tournaments/${tournament.id}`)
    await page.getByRole('button', { name: 'Inscrever' }).click()
    await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill(name)
    const select = page.getByRole('combobox', { name: /^Atleta/ })
    await expect(select.locator(`option[value="${withClub.id}"]`)).toHaveText(`${name} · ${club.name}`)
    await expect(select.locator(`option[value="${withoutClub.id}"]`)).toHaveText(`${name} · Sem clube`)
  })
})
