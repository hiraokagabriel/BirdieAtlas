import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { createCategory, createTournament, uniqueTag } from '../support/factories.js'

// Amistoso com jogadores avulsos (sem cadastro): a lista colada cria os avulsos, inscreve e aprova; o mesmo nome
// em outra categoria é o mesmo jogador; avulsos ficam fora da lista de Atletas.

type Reg = { athleteId: string | null; athlete2Id: string | null; athleteName: string | null; athlete2Name: string | null; status: string }
type ErrorBody = { error: string; code?: string; details?: { errors: { line: number; message: string }[] } }

test('lista colada cria avulsos, inscreve aprovado e reaproveita o mesmo nome em outra categoria', async () => {
  const tag = uniqueTag()
  const tournament = await createTournament({ name: `Amistoso Avulsos ${tag}`, kind: 'friendly', status: 'registration_open' })
  const singles = await createCategory(tournament.id, { name: 'Simples Masculino', discipline: 'MS' })
  const mixed = await createCategory(tournament.id, { name: 'Dupla Mista', discipline: 'XD' })

  const first = await api.post<{ registered: number; athletesCreated: number; athletesReused: number }>(
    `/tournaments/categories/${singles.id}/guests`,
    { text: `Carlos Dias ${tag}\n\nPedro Lima ${tag} (2008)` },
  )
  expect(first).toEqual({ registered: 2, athletesCreated: 2, athletesReused: 0 })

  // "carlos dias" (caixa e espaços diferentes) é o mesmo avulso da simples.
  const second = await api.post<{ registered: number; athletesCreated: number; athletesReused: number }>(
    `/tournaments/categories/${mixed.id}/guests`,
    { text: `carlos   dias ${tag} / Ana Souza ${tag}` },
  )
  expect(second).toEqual({ registered: 1, athletesCreated: 1, athletesReused: 1 })

  const singlesRegs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${tournament.id}?categoryId=${singles.id}&pageSize=100`)).data
  const mixedRegs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${tournament.id}?categoryId=${mixed.id}&pageSize=100`)).data
  expect(singlesRegs.every((r) => r.status === 'approved')).toBe(true)
  const carlos = singlesRegs.find((r) => r.athleteName === `Carlos Dias ${tag}`)
  expect(carlos).toBeDefined()
  expect(mixedRegs).toHaveLength(1)
  expect(mixedRegs[0]!.athleteId).toBe(carlos!.athleteId)

  // Avulsos fora da lista de Atletas do admin.
  const listed = await api.get<{ data: { id: string }[] }>(`/athletes?search=${encodeURIComponent(tag)}&pageSize=100`)
  expect(listed.data).toEqual([])
})

test('erros por linha não gravam nada; torneio oficial recusa avulsos', async () => {
  const tag = uniqueTag()
  const friendly = await createTournament({ name: `Amistoso Erros ${tag}`, kind: 'friendly', status: 'registration_open' })
  const category = await createCategory(friendly.id, { discipline: 'MS' })
  const bad = await apiCall<ErrorBody>('POST', `/tournaments/categories/${category.id}/guests`, { text: `Ana Souza ${tag}\nSozinho\nAna Souza ${tag}` })
  expect(bad.status).toBe(422)
  expect(bad.body.code).toBe('GUEST_LIST_INVALID')
  expect(bad.body.details?.errors.map((e) => e.line)).toEqual([2, 3])
  const regs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${friendly.id}?pageSize=100`)).data
  expect(regs).toEqual([])

  const official = await createTournament({ name: `Oficial ${tag}`, status: 'registration_open' })
  const officialCategory = await createCategory(official.id, { discipline: 'MS' })
  const refused = await apiCall<ErrorBody>('POST', `/tournaments/categories/${officialCategory.id}/guests`, { text: `Ana Souza ${tag}` })
  expect(refused.status).toBe(409)
  expect(refused.body.code).toBe('TOURNAMENT_NOT_FRIENDLY')
})

test('na aba Inscrições do amistoso, "Colar lista" adiciona os jogadores', async ({ page }) => {
  const tag = uniqueTag()
  const tournament = await createTournament({ name: `Amistoso Tela ${tag}`, kind: 'friendly', status: 'registration_open' })
  await createCategory(tournament.id, { discipline: 'MS' })

  await page.goto(`/admin/tournaments/${tournament.id}`)
  await page.getByRole('button', { name: 'Colar lista' }).click()
  await page.getByLabel('Jogadores (um por linha)').fill(`Bruno Alves ${tag}\nDiego Reis ${tag}`)
  await page.getByRole('button', { name: 'Adicionar jogadores' }).click()
  await expect(page.getByRole('status').filter({ hasText: '2 inscrições criadas' })).toBeVisible()
  await expect(page.getByText(`Bruno Alves ${tag}`)).toBeVisible()
  await expect(page.getByText(`Diego Reis ${tag}`)).toBeVisible()
})

test('planilha de amistoso: nomes viram avulsos sem clube e casam com avulso existente', async () => {
  const tag = uniqueTag()
  // Um avulso já existente (de outro amistoso) com o mesmo nome deve ser reaproveitado.
  const earlier = await createTournament({ name: `Amistoso Antes ${tag}`, kind: 'friendly', status: 'registration_open' })
  const earlierCategory = await createCategory(earlier.id, { discipline: 'MS' })
  await api.post(`/tournaments/categories/${earlierCategory.id}/guests`, { text: `Velho Conhecido ${tag}` })

  const res = await apiCall<{ ok: boolean; tournamentId?: string; summary: { athletes: { existing: number; created: number }; clubs: { created: number } } }>('POST', '/import/tournament', {
    dryRun: false,
    tournament: { name: `Amistoso Planilha ${tag}`, startDate: '15/11/2099', endDate: '17/11/2099', kind: 'Amistoso' },
    categories: [
      { row: 2, name: 'Simples A', discipline: 'Simples Masculino', drawType: 'Mata-mata' },
      { row: 3, name: 'Simples B', discipline: 'Simples Masculino', drawType: 'Mata-mata' },
    ],
    entries: [
      { row: 2, category: 'Simples A', athlete: `Velho Conhecido ${tag}`, gender: 'M', club: `Clube Ignorado ${tag}` },
      { row: 3, category: 'Simples A', athlete: `Novo Avulso ${tag}`, gender: 'M' },
      // Mesmo nome com clube em outra categoria: o clube é ignorado, é o mesmo avulso.
      { row: 4, category: 'Simples B', athlete: `Novo Avulso ${tag}`, gender: 'M', club: `Outro Clube ${tag}` },
    ],
  })
  expect(res.status).toBe(201)
  expect(res.body.summary.athletes).toEqual({ existing: 1, created: 1 })
  expect(res.body.summary.clubs.created).toBe(0)

  const regs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${res.body.tournamentId}?pageSize=100`)).data
  const earlierRegs = (await api.get<{ data: Reg[] }>(`/registrations/tournament/${earlier.id}?pageSize=100`)).data
  expect(regs.find((r) => r.athleteName === `Velho Conhecido ${tag}`)?.athleteId).toBe(earlierRegs[0]!.athleteId)
  const novos = regs.filter((r) => r.athleteName === `Novo Avulso ${tag}`)
  expect(novos).toHaveLength(2)
  expect(novos[0]!.athleteId).toBe(novos[1]!.athleteId)
  expect((await api.get<{ data: unknown[] }>(`/athletes?search=${encodeURIComponent(tag)}&pageSize=100`)).data).toEqual([])
})
