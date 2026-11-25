import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { createAthlete, createCategory, createTournament, uniqueTag } from '../support/factories.js'

// Juntar um avulso (jogador de amistoso) a um atleta cadastrado: inscrições e duplas passam para o atleta.

type Reg = { id: string; categoryId: string; athleteId: string | null; athlete2Id: string | null }
type Guest = { id: string; name: string }

async function guestsNamed(name: string): Promise<Guest[]> {
  return (await api.get<{ data: Guest[] }>(`/athletes?guest=true&search=${encodeURIComponent(name)}`)).data
}

async function friendlyWithGuest(tag: string, guestName: string) {
  const tournament = await createTournament({ name: `Amistoso Junção ${tag}`, kind: 'friendly', status: 'registration_open' })
  const singles = await createCategory(tournament.id, { name: 'Simples Masculino', discipline: 'MS' })
  const doubles = await createCategory(tournament.id, { name: 'Duplas Masculinas', discipline: 'MD' })
  await api.post(`/tournaments/categories/${singles.id}/guests`, { text: guestName })
  await api.post(`/tournaments/categories/${doubles.id}/guests`, { text: `${guestName} / Parceiro Avulso ${tag}` })
  const [guest] = await guestsNamed(guestName)
  return { tournament, singles, doubles, guest: guest! }
}

test('API: junta o avulso ao atleta, com simples e dupla, e recusa os casos inválidos', async () => {
  const tag = uniqueTag()
  const name = `Rafa Junção ${tag}`
  const { tournament, guest } = await friendlyWithGuest(tag, name)
  const target = await createAthlete({ name: `Rafael Junção ${tag}`, gender: 'M' })
  const woman = await createAthlete({ name: `Ana Junção ${tag}`, gender: 'F' })

  // Recusas: origem não avulsa, gênero diferente, destino inexistente.
  expect((await apiCall('POST', `/athletes/${target.id}/merge`, { targetAthleteId: woman.id })).body).toMatchObject({ code: 'ATHLETE_NOT_GUEST' })
  expect((await apiCall('POST', `/athletes/${guest.id}/merge`, { targetAthleteId: woman.id })).status).toBe(422)
  expect((await apiCall('POST', `/athletes/${guest.id}/merge`, { targetAthleteId: 'nao-existe' })).status).toBe(404)

  const merged = await api.post<{ registrationsMoved: number; pairsUpdated: number }>(`/athletes/${guest.id}/merge`, { targetAthleteId: target.id })
  expect(merged).toMatchObject({ registrationsMoved: 1, pairsUpdated: 1 })

  const regs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${tournament.id}?pageSize=100`)).data
  expect(regs.filter((r) => r.athleteId === target.id || r.athlete2Id === target.id)).toHaveLength(2)
  expect(regs.some((r) => r.athleteId === guest.id || r.athlete2Id === guest.id)).toBe(false)
  expect(await guestsNamed(name)).toEqual([])
  // O avulso sumiu: juntar de novo é 404.
  expect((await apiCall('POST', `/athletes/${guest.id}/merge`, { targetAthleteId: target.id })).status).toBe(404)
})

test('API: os dois inscritos na mesma categoria é conflito, e nada muda', async () => {
  const tag = uniqueTag()
  const name = `Beto Conflito ${tag}`
  const { singles, guest } = await friendlyWithGuest(tag, name)
  const target = await createAthlete({ name: `Roberto Conflito ${tag}`, gender: 'M' })
  await api.post(`/tournaments/categories/${singles.id}/register`, { athleteId: target.id })

  const res = await apiCall('POST', `/athletes/${guest.id}/merge`, { targetAthleteId: target.id })
  expect(res.status).toBe(409)
  expect(res.body).toMatchObject({ code: 'MERGE_CONFLICT', details: { categories: ['Simples Masculino'] } })
  expect(await guestsNamed(name)).toHaveLength(1)
})

test('tela: aba Avulsos em Atletas junta o avulso pelo diálogo', async ({ page }) => {
  const tag = uniqueTag()
  const name = `Caio Tela ${tag}`
  await friendlyWithGuest(tag, name)
  const target = await createAthlete({ name: `Caio Cadastrado ${tag}`, gender: 'M' })

  await page.goto('/admin/athletes')
  await page.getByRole('tab', { name: 'Avulsos' }).click()
  await page.getByRole('searchbox', { name: 'Buscar avulso' }).fill(name)
  await page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Juntar com atleta' }).click()

  const dialog = page.getByRole('dialog', { name: `Juntar ${name} com atleta cadastrado` })
  await dialog.getByRole('button', { name: /Atleta cadastrado/ }).click()
  await dialog.getByRole('searchbox', { name: /Buscar atleta/ }).fill(target.name)
  await dialog.getByRole('button', { name: new RegExp(target.name) }).click()
  await dialog.getByRole('button', { name: 'Juntar', exact: true }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: `${name} agora é ${target.name}` })).toBeVisible()
  await expect(page.getByText('Nenhum avulso com esse nome.')).toBeVisible()
})
