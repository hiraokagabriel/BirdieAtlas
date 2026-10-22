import { expect, test } from '@playwright/test'
import { api, apiCall, setAdminMode } from '../support/api.js'
import {
  createAthlete,
  createCategory,
  createTournament,
  prepareTournament,
  type PreparedTournament,
  type Tournament,
} from '../support/factories.js'

// Guard de autorização: sem o modo admin, toda escrita e as leituras com dados pessoais devolvem 403
// (ADMIN_MODE_DISABLED); leituras públicas seguem funcionando e a interface mostra a mensagem da API.
// O modo admin é global na API de teste. Este spec roda sozinho (projeto `guard`, depois do `main`)
// e restaura o modo ligado no `afterAll`, mesmo se um teste falhar.

const DENIED_MESSAGE = 'Acesso negado: esta operação exige o modo admin.'

interface ErrorBody {
  error: string
  code: string
  details?: { hint?: string }
}

let draftTournament: Tournament
let playing: PreparedTournament

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await setAdminMode(true)
  draftTournament = await createTournament({ name: `Guard Rascunho ${Date.now().toString(36)}` })
  await createCategory(draftTournament.id)
  playing = await prepareTournament({ name: `Guard Jogo ${Date.now().toString(36)}` })
})

test.afterAll(async () => {
  await setAdminMode(true)
})

test.beforeEach(async () => {
  await setAdminMode(false)
})

test.afterEach(async () => {
  await setAdminMode(true)
})

test.describe('API', () => {
  test('o estado do modo admin é consultável e reversível', async () => {
    expect((await api.get<{ adminMode: boolean }>('/dev/admin-mode')).adminMode).toBe(false)
    await setAdminMode(true)
    expect((await api.get<{ adminMode: boolean }>('/dev/admin-mode')).adminMode).toBe(true)
  })

  const writes: { title: string; method: string; path: () => string; body?: unknown }[] = [
    { title: 'POST /athletes', method: 'POST', path: () => '/athletes', body: { name: 'Fulano Barrado', gender: 'M' } },
    { title: 'POST /tournaments', method: 'POST', path: () => '/tournaments', body: { name: 'X', slug: 'x', startDate: '2098-01-01', endDate: '2098-01-02' } },
    { title: 'PUT /tournaments/:id', method: 'PUT', path: () => `/tournaments/${draftTournament.id}`, body: { name: 'Outro nome' } },
    { title: 'POST /tournaments/:id/transition', method: 'POST', path: () => `/tournaments/${draftTournament.id}/transition`, body: { to: 'registration_open' } },
    { title: 'POST /draws/:id/unpublish', method: 'POST', path: () => `/draws/${playing.draw.id}/unpublish` },
    { title: 'POST /draws/matches/:id/result', method: 'POST', path: () => `/draws/matches/${playing.matches[0]?.id}/result`, body: { sets: [], status: 'completed' } },
    { title: 'POST /draws/matches/:id/live/start', method: 'POST', path: () => `/draws/matches/${playing.matches[0]?.id}/live/start`, body: {} },
    { title: 'POST /tournaments/:id/schedule/auto', method: 'POST', path: () => `/tournaments/${playing.tournament.id}/schedule/auto`, body: { courts: 1 } },
    { title: 'DELETE /tournaments/:id', method: 'DELETE', path: () => `/tournaments/${draftTournament.id}` },
  ]

  for (const write of writes) {
    test(`${write.title} é recusado com 403`, async () => {
      const res = await apiCall<ErrorBody>(write.method, write.path(), write.body)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('ADMIN_MODE_DISABLED')
      expect(res.body.error).toBe(DENIED_MESSAGE)
      expect(res.body.details?.hint).toContain('DEV_ADMIN_MODE')
    })
  }

  test('nenhuma recusa gravou nada', async () => {
    await setAdminMode(true)
    const after = await api.get<Tournament>(`/tournaments/${draftTournament.id}`)
    expect(after.status).toBe('draft')
    expect(after.name).toBe(draftTournament.name)
    const published = await api.get<{ id: string; published: boolean }[]>(`/tournaments/categories/${playing.category.id}/draws`)
    expect(published[0]?.published).toBe(true)
  })

  test('leituras com dados pessoais também exigem o modo admin', async () => {
    for (const path of [
      '/athletes',
      `/athletes/${playing.athletes[0]?.id}`,
      `/registrations/tournament/${playing.tournament.id}`,
      `/tournaments/${playing.tournament.id}/registrations/export.csv`,
    ]) {
      const res = await apiCall<ErrorBody>('GET', path)
      expect(res.status, path).toBe(403)
      expect(res.body.code, path).toBe('ADMIN_MODE_DISABLED')
    }
  })

  test('as leituras públicas continuam funcionando', async () => {
    const publicReads = [
      '/tournaments?public=true',
      `/tournaments/by-slug/${playing.tournament.slug}`,
      `/tournaments/${playing.tournament.id}/public-summary`,
      `/tournaments/categories/${playing.category.id}/registrations`,
      `/draws/${playing.draw.id}/matches`,
      `/tournaments/${playing.tournament.id}/live/matches`,
      `/athletes/search?q=${encodeURIComponent('Atleta')}`,
      `/athletes/${playing.athletes[0]?.id}/profile`,
      '/rankings?tenantSlug=fpb-sp',
      '/tenants',
    ]
    for (const path of publicReads) {
      const res = await apiCall('GET', path)
      expect(res.status, path).toBe(200)
    }
  })
})

test.describe('interface', () => {
  test('as páginas públicas seguem funcionando', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Próximos torneios' }).getByRole('link').first()).toBeVisible()

    await page.goto(`/t/${playing.tournament.slug}`)
    await expect(page.getByRole('heading', { level: 1, name: playing.tournament.name })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Chave de Simples Masculino' })).toBeVisible()
  })

  test('mudar o status de um torneio mostra a mensagem do servidor e não altera nada', async ({ page }) => {
    await page.goto(`/admin/tournaments/${draftTournament.id}`)
    await expect(page.getByText('Rascunho', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Abrir inscrições' }).click()

    await expect(page.getByText('Não foi possível mudar o status')).toBeVisible()
    await expect(page.getByText(DENIED_MESSAGE, { exact: true })).toBeVisible()
    await expect(page.getByText('Rascunho', { exact: true })).toBeVisible()

    await setAdminMode(true)
    expect((await api.get<Tournament>(`/tournaments/${draftTournament.id}`)).status).toBe('draft')
  })

  test('lançar resultado mostra a mensagem no próprio diálogo', async ({ page }) => {
    await page.goto(`/admin/tournaments/${playing.tournament.id}`)
    await page.getByRole('tab', { name: 'Chaveamento' }).click()
    await page.getByRole('button', { name: /^(?!.*vencedor).*Abrir resultado/ }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Lançar Resultado' })
    const scores = dialog.getByRole('spinbutton')
    await scores.nth(0).fill('21')
    await scores.nth(1).fill('10')
    await scores.nth(2).fill('21')
    await scores.nth(3).fill('10')
    await dialog.getByRole('button', { name: 'Confirmar resultado' }).click()

    await expect(dialog.getByRole('alert')).toHaveText(DENIED_MESSAGE)
    await expect(dialog).toBeVisible()
  })

  test('a lista de atletas do admin mostra o erro em vez de ficar carregando', async ({ page }) => {
    await page.goto('/admin/athletes')
    await expect(page.getByRole('heading', { level: 2, name: 'Atletas' })).toBeVisible()
    // GET /athletes é leitura de admin: o 403 precisa virar uma mensagem na tela (a tela trata o estado de erro).
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText('Acesso negado', { timeout: 20_000 }) // o TanStack Query tenta 3 vezes antes de falhar
    await expect(page.getByText('Carregando...')).toHaveCount(0)
  })

  test('a aba Inscrições do torneio mostra o erro em vez de "nenhum inscrito"', async ({ page }) => {
    await page.goto(`/admin/tournaments/${playing.tournament.id}`)
    // GET /registrations/tournament/:id é leitura de admin: o 403 não pode virar uma lista vazia.
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText('Acesso negado', { timeout: 20_000 })
    await expect(page.getByText('Nenhum inscrito nesta categoria ainda.')).toHaveCount(0)
  })

  test('criar atleta pelo modal mostra o erro e não cria nada', async ({ page }) => {
    const name = `Fulano Barrado ${Date.now().toString(36)}`
    await page.goto('/admin/athletes')
    await page.getByRole('button', { name: 'Novo atleta' }).click()
    await page.getByPlaceholder('ex: João Silva').fill(name)
    await page.getByRole('button', { name: 'Criar atleta' }).click()
    // O modal usa uma mensagem genérica para qualquer falha da API; o importante é não fingir sucesso.
    await expect(page.getByText('Erro ao criar atleta. Tente novamente.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Novo atleta' })).toBeVisible()

    await setAdminMode(true)
    const found = await api.get<{ data: { name: string }[] }>(`/athletes?search=${encodeURIComponent(name)}`)
    expect(found.data).toEqual([])
  })
})

test.describe('depois de restaurar', () => {
  test('com o modo admin de volta, as escritas voltam a funcionar', async ({ page }) => {
    await setAdminMode(true)
    const athlete = await createAthlete({ name: `Restaurado ${Date.now().toString(36)}` })
    expect(athlete.id).toBeTruthy()

    await page.goto(`/admin/tournaments/${draftTournament.id}`)
    await page.getByRole('button', { name: 'Abrir inscrições' }).click()
    await expect(page.getByText('Inscrições abertas', { exact: true })).toBeVisible()
    expect((await api.get<Tournament>(`/tournaments/${draftTournament.id}`)).status).toBe('registration_open')
  })
})
