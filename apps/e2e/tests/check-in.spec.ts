import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import {
  createAthlete, createCategory, createTournament, finalizeTournament, playWholeDraw, prepareTournament, uniqueTag,
} from '../support/factories.js'

// Check-in: presença confirmada na mesa no dia do torneio. Só inscrições aprovadas; a fila do operador
// mostra quem já confirmou.

interface RegistrationRow {
  id: string
  athleteId: string
  status: string
  checkedInAt: string | null
}

const checkIn = (id: string) => apiCall<RegistrationRow & { code?: string }>('POST', `/registrations/${id}/check-in`)
const undo = (id: string) => apiCall<RegistrationRow>('DELETE', `/registrations/${id}/check-in`)

test.describe('check-in pela API', () => {
  test('aprovada confirma e desfaz; pendente é recusada; sair de aprovada apaga a presença', async () => {
    const tournament = await createTournament({ status: 'registration_open' })
    const category = await createCategory(tournament.id)
    const athlete = await createAthlete({ gender: 'M' })
    const reg = await api.post<RegistrationRow>(`/tournaments/categories/${category.id}/register`, { athleteId: athlete.id })
    expect(reg.checkedInAt).toBeNull()

    const pending = await checkIn(reg.id)
    expect(pending.status).toBe(422)
    expect(pending.body.code).toBe('REGISTRATION_NOT_APPROVED')

    await api.post(`/registrations/${reg.id}/approve`, {})
    const first = await checkIn(reg.id)
    expect(first.status).toBe(200)
    expect(first.body.checkedInAt).not.toBeNull()
    // Idempotente: confirmar de novo mantém o horário da primeira confirmação.
    expect((await checkIn(reg.id)).body.checkedInAt).toBe(first.body.checkedInAt)

    expect((await undo(reg.id)).body.checkedInAt).toBeNull()

    await checkIn(reg.id)
    const back = await api.patch<RegistrationRow>(`/registrations/${reg.id}`, { status: 'pending' })
    expect(back.checkedInAt).toBeNull()

    expect((await checkIn('nao-existe')).status).toBe(404)
  })

  test('remanejar de categoria mantém a presença', async () => {
    const tournament = await createTournament({ status: 'registration_open' })
    const from = await createCategory(tournament.id, { name: 'Simples A' })
    const to = await createCategory(tournament.id, { name: 'Simples B' })
    const athlete = await createAthlete({ gender: 'M' })
    const reg = await api.post<RegistrationRow>(`/tournaments/categories/${from.id}/register`, { athleteId: athlete.id })
    await api.post(`/registrations/${reg.id}/approve`, {})
    const checked = (await checkIn(reg.id)).body.checkedInAt
    const moved = await api.patch<RegistrationRow>(`/registrations/${reg.id}`, { categoryId: to.id })
    expect(moved.checkedInAt).toBe(checked)
  })

  test('torneio encerrado não aceita check-in', async () => {
    const done = await prepareTournament({ athleteCount: 2 })
    await playWholeDraw(done.draw.id)
    await finalizeTournament(done.tournament.id)
    const res = await checkIn(done.registrations[0]!.id)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TOURNAMENT_LOCKED')
  })

  test('a fila do operador diz quem já confirmou presença', async () => {
    const prepared = await prepareTournament({ athleteCount: 2 })
    const [match] = prepared.matches
    await checkIn(match!.registration1Id!)
    const queue = await api.get<{ matchId: string; checkedIn1: boolean; checkedIn2: boolean }[]>(`/tournaments/${prepared.tournament.id}/live/queue`)
    expect(queue.find((q) => q.matchId === match!.id)).toMatchObject({ checkedIn1: true, checkedIn2: false })
  })
})

test('na aba Inscrições, o botão Presente confirma e desfaz, com a contagem', async ({ page }) => {
  const tournament = await createTournament({ status: 'in_progress' })
  const category = await createCategory(tournament.id)
  const tag = uniqueTag()
  const athlete = await createAthlete({ name: `Presença ${tag}`, gender: 'M' })
  const reg = await api.post<RegistrationRow>(`/tournaments/categories/${category.id}/register`, { athleteId: athlete.id })
  await api.post(`/registrations/${reg.id}/approve`, {})

  await page.goto(`/admin/tournaments/${tournament.id}`)
  const toggle = page.getByRole('button', { name: `Presente: ${athlete.name}` })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Presença confirmada: 0 de 1 aprovadas')).toBeVisible()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Presença confirmada: 1 de 1 aprovadas')).toBeVisible()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect((await api.get<{ data: RegistrationRow[] }>(`/registrations/tournament/${tournament.id}`)).data[0]?.checkedInAt).toBeNull()
})
