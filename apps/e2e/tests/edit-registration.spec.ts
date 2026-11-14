import { expect, test } from '@playwright/test'
import { api, apiCall } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { settle, THEMES, useTheme } from '../support/wcag-page.js'
import {
  affiliate, createAthlete, createCategory, createClub, createTournament, generateDraw, registerApproved, uniqueTag,
} from '../support/factories.js'

// Edição simplificada de inscrições: remanejar de categoria, trocar parceiro(a), substituir atleta,
// cabeça de chave e clube. Em torneio amistoso quase tudo é editável; no oficial valem as regras de sempre.

interface Reg {
  id: string
  categoryId: string
  athleteId: string
  athlete2Id: string | null
  athleteName: string | null
  athleteClub: string | null
  athlete2Club: string | null
  seed: number | null
  status: string
}

const patch = (id: string, body: unknown) => apiCall<Reg & { code?: string; error?: string }>('PATCH', `/registrations/${id}`, body)

async function listRegs(tournamentId: string): Promise<Reg[]> {
  return (await api.get<{ data: Reg[] }>(`/registrations/tournament/${tournamentId}?pageSize=100`)).data
}

async function register(categoryId: string, athleteId: string, athlete2Id?: string): Promise<Reg> {
  return api.post<Reg>(`/tournaments/categories/${categoryId}/register`, { athleteId, ...(athlete2Id ? { athlete2Id } : {}) })
}

test.describe('editar inscrição (API)', () => {
  test('remaneja de categoria na mesma disciplina, respeitando vagas e inscrição repetida', async () => {
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const a = await createCategory(t.id, { name: 'A', discipline: 'MS' })
    const b = await createCategory(t.id, { name: 'B', discipline: 'MS' })
    const [x, y] = [await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' })]
    const regX = await register(a.id, x.id)
    await register(b.id, y.id)

    const moved = await patch(regX.id, { categoryId: b.id })
    expect(moved.status).toBe(200)
    expect(moved.body.categoryId).toBe(b.id)

    // mesma pessoa já inscrita na categoria de destino: 409, nada muda
    const regX2 = await register(a.id, x.id)
    const dup = await patch(regX2.id, { categoryId: b.id })
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe('ATHLETE_ALREADY_REGISTERED')
    expect((await listRegs(t.id)).find((r) => r.id === regX2.id)?.categoryId).toBe(a.id)
  })

  test('amistoso remaneja para outra disciplina informando os atletas certos; oficial não', async () => {
    const friendly = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const ms = await createCategory(friendly.id, { name: 'Simples', discipline: 'MS' })
    const md = await createCategory(friendly.id, { name: 'Duplas', discipline: 'MD' })
    const [p, q] = [await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' })]
    const reg = await register(ms.id, p.id)

    // sem o parceiro, simples -> duplas é recusado
    const missing = await patch(reg.id, { categoryId: md.id })
    expect(missing.status).toBe(422)
    expect(missing.body.code).toBe('WRONG_PARTICIPANT_COUNT')

    const ok = await patch(reg.id, { categoryId: md.id, athlete2Id: q.id })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ categoryId: md.id, athleteId: p.id, athlete2Id: q.id })

    const official = await createTournament({ kind: 'official', status: 'registration_open' })
    const oms = await createCategory(official.id, { name: 'Simples', discipline: 'MS' })
    const omd = await createCategory(official.id, { name: 'Duplas', discipline: 'MD' })
    const [r, s] = [await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' })]
    const oreg = await register(oms.id, r.id)
    const denied = await patch(oreg.id, { categoryId: omd.id, athlete2Id: s.id })
    expect(denied.status).toBe(422)
    expect(denied.body.code).toBe('INVALID_REGISTRATION_CATEGORY')
  })

  test('troca de parceiro(a) cria ou reaproveita a dupla e valida o gênero', async () => {
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const xd = await createCategory(t.id, { name: 'Mista', discipline: 'XD' })
    const [m1, m2] = [await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' })]
    const [w1, w2] = [await createAthlete({ gender: 'F' }), await createAthlete({ gender: 'F' })]
    const reg = await register(xd.id, m1.id, w1.id)

    const swapped = await patch(reg.id, { athlete2Id: w2.id })
    expect(swapped.status).toBe(200)
    expect(swapped.body).toMatchObject({ athleteId: m1.id, athlete2Id: w2.id })

    // dois homens em dupla mista: recusado
    const bad = await patch(reg.id, { athlete2Id: m2.id })
    expect(bad.status).toBe(422)
    expect(bad.body.code).toBe('GENDER_INCOMPATIBLE')

    // a mesma pessoa nos dois lados: recusado
    const same = await patch(reg.id, { athlete2Id: m1.id })
    expect(same.status).toBe(422)

    // quem já joga a categoria em outra dupla não entra de novo
    const otherW = await createAthlete({ gender: 'F' })
    const otherM = await createAthlete({ gender: 'M' })
    await register(xd.id, otherM.id, otherW.id)
    const taken = await patch(reg.id, { athlete2Id: otherW.id })
    expect(taken.status).toBe(409)
    expect(taken.body.code).toBe('ATHLETE_ALREADY_REGISTERED')
  })

  test('substitui o atleta de uma inscrição de simples e define cabeça de chave', async () => {
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const cat = await createCategory(t.id, { name: 'Simples', discipline: 'MS' })
    const [out, sub] = [await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' })]
    const woman = await createAthlete({ gender: 'F' })
    const reg = await register(cat.id, out.id)

    const done = await patch(reg.id, { athleteId: sub.id, seed: 2 })
    expect(done.status).toBe(200)
    expect(done.body).toMatchObject({ athleteId: sub.id, seed: 2 })

    expect((await patch(reg.id, { athleteId: woman.id })).body.code).toBe('GENDER_INCOMPATIBLE')
    const cleared = await patch(reg.id, { seed: null })
    expect(cleared.body.seed).toBeNull()
  })

  test('na chave: amistoso aceita substituição, oficial não; remanejar sempre exige refazer a chave', async () => {
    for (const kind of ['friendly', 'official'] as const) {
      const t = await createTournament({ kind, status: 'registration_open' })
      const cat = await createCategory(t.id, { name: 'Simples', discipline: 'MS' })
      const other = await createCategory(t.id, { name: 'Outra', discipline: 'MS' })
      const athletes = [await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' })]
      const regs = await registerApproved(cat.id, athletes)
      await api.post(`/tournaments/${t.id}/transition`, { to: 'registration_closed' })
      await generateDraw(cat.id)

      const substitute = await createAthlete({ gender: 'M' })
      const swap = await patch(regs[0]!.id, { athleteId: substitute.id })
      if (kind === 'friendly') {
        expect(swap.status).toBe(200)
        expect(swap.body.athleteId).toBe(substitute.id)
      } else {
        expect(swap.status).toBe(409)
        expect(swap.body.code).toBe('REGISTRATION_IN_DRAW')
      }
      const move = await patch(regs[1]!.id, { categoryId: other.id })
      expect(move.status).toBe(409)
      expect(move.body.code).toBe('REGISTRATION_IN_DRAW')
    }
  })

  test('reabrir recusada respeita a elegibilidade (não duplica inscrição)', async () => {
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const cat = await createCategory(t.id, { name: 'Simples', discipline: 'MS' })
    const x = await createAthlete({ gender: 'M' })
    const first = await register(cat.id, x.id)
    expect((await patch(first.id, { status: 'rejected', notes: 'faltou' })).status).toBe(200)
    await register(cat.id, x.id) // nova inscrição da mesma pessoa
    const reopen = await patch(first.id, { status: 'pending' })
    expect(reopen.status).toBe(409)
    expect(reopen.body.code).toBe('ATHLETE_ALREADY_REGISTERED')
  })

  test('troca o clube do atleta: existente, novo pelo nome (reaproveitado depois) e sem clube', async () => {
    const tag = uniqueTag()
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const cat = await createCategory(t.id, { name: 'Simples', discipline: 'MS' })
    const athlete = await createAthlete({ gender: 'M' })
    const old = await createClub({ name: `Clube Antigo ${tag}` })
    await affiliate(athlete.id, old.id)
    const reg = await register(cat.id, athlete.id)
    expect((await listRegs(t.id)).find((r) => r.id === reg.id)?.athleteClub).toBe(`Clube Antigo ${tag}`)

    const created = await apiCall('PUT', `/athletes/${athlete.id}/current-club`, { clubName: `Clube Novo ${tag}` })
    expect(created.status).toBe(200)
    expect((await listRegs(t.id)).find((r) => r.id === reg.id)?.athleteClub).toBe(`Clube Novo ${tag}`)

    // outro atleta com o mesmo nome (caixa e acento diferentes) usa o clube que já existe
    const other = await createAthlete({ gender: 'M' })
    await apiCall('PUT', `/athletes/${other.id}/current-club`, { clubName: `CLUBE NOVO ${tag}` })
    const clubs = await api.get<{ data: { name: string }[] }>(`/clubs?pageSize=100`)
    expect(clubs.data.filter((c) => c.name.toLowerCase() === `clube novo ${tag}`.toLowerCase())).toHaveLength(1)

    const none = await apiCall('PUT', `/athletes/${athlete.id}/current-club`, { clubId: null })
    expect(none.status).toBe(200)
    expect((await listRegs(t.id)).find((r) => r.id === reg.id)?.athleteClub).toBeNull()

    expect((await apiCall('PUT', `/athletes/${athlete.id}/current-club`, {})).status).toBe(400)
    expect((await apiCall('PUT', `/athletes/${athlete.id}/current-club`, { clubId: 'nao-existe' })).status).toBe(404)
  })

  test('torneio encerrado continua bloqueado', async () => {
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const cat = await createCategory(t.id, { name: 'Simples', discipline: 'MS' })
    const x = await createAthlete({ gender: 'M' })
    const reg = await register(cat.id, x.id)
    await api.post(`/tournaments/${t.id}/transition`, { to: 'cancelled' })
    const res = await patch(reg.id, { seed: 1 })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TOURNAMENT_LOCKED')
  })
})

test.describe('editar inscrição (tela)', () => {
  test('remaneja, troca o parceiro e o clube pela aba Inscrições', async ({ page }) => {
    const tag = uniqueTag()
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const a = await createCategory(t.id, { name: 'Duplas A', discipline: 'MD' })
    const b = await createCategory(t.id, { name: 'Duplas B', discipline: 'MD' })
    const p1 = await createAthlete({ name: `Primeiro ${tag}`, gender: 'M' })
    const p2 = await createAthlete({ name: `Segundo ${tag}`, gender: 'M' })
    const p3 = await createAthlete({ name: `Terceiro ${tag}`, gender: 'M' })
    const club = await createClub({ name: `Clube Ed ${tag}` })
    await affiliate(p1.id, club.id)
    const reg = await register(a.id, p1.id, p2.id)

    await page.goto(`/admin/tournaments/${t.id}`)
    await expect(page.getByText(`(Clube Ed ${tag})`)).toBeVisible()
    await page.getByRole('button', { name: `Editar inscrição de ${p1.name}` }).click()
    const form = page.getByRole('form', { name: `Editar inscrição de ${p1.name}` })
    await expect(form).toBeVisible()

    await form.getByRole('combobox', { name: /^Categoria/ }).selectOption(b.id)
    await form.getByRole('searchbox', { name: /^Buscar atleta para substituir/ }).fill(p3.name)
    const partner = form.getByRole('combobox', { name: /^Atleta 2/ })
    await expect(partner.getByRole('option', { name: new RegExp(p3.name) })).toHaveCount(1)
    await partner.selectOption(p3.id)
    await form.getByRole('combobox', { name: /^Clube de/ }).first().fill(`Clube Digitado ${tag}`)
    await form.getByRole('button', { name: 'Salvar alterações' }).click()

    await expect(form).toHaveCount(0)
    await expect.poll(async () => (await listRegs(t.id)).find((r) => r.id === reg.id)).toMatchObject({
      categoryId: b.id, athlete2Id: p3.id, athleteClub: `Clube Digitado ${tag}`,
    })
  })

  test('erro da API aparece no formulário sem fechar', async ({ page }) => {
    const tag = uniqueTag()
    const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
    const a = await createCategory(t.id, { name: 'Simples A', discipline: 'MS' })
    const b = await createCategory(t.id, { name: 'Simples B', discipline: 'MS' })
    const x = await createAthlete({ name: `Repetido ${tag}`, gender: 'M' })
    await register(b.id, x.id)
    await register(a.id, x.id)

    await page.goto(`/admin/tournaments/${t.id}`)
    await page.getByRole('button', { name: `Editar inscrição de ${x.name}` }).click()
    const form = page.getByRole('form', { name: `Editar inscrição de ${x.name}` })
    await form.getByRole('combobox', { name: /^Categoria/ }).selectOption(b.id)
    await form.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(form.getByRole('alert')).toContainText('já inscrito')
    await expect(form).toBeVisible()
  })

  for (const theme of THEMES) {
    test(`formulário de edição sem violações de acessibilidade (${theme})`, async ({ page }) => {
      await useTheme(page, theme)
      const t = await createTournament({ kind: 'friendly', status: 'registration_open' })
      const cat = await createCategory(t.id, { name: 'Duplas', discipline: 'MD' })
      const [p, q] = [await createAthlete({ gender: 'M' }), await createAthlete({ gender: 'M' })]
      await register(cat.id, p.id, q.id)
      await page.goto(`/admin/tournaments/${t.id}`)
      await page.getByRole('button', { name: `Editar inscrição de ${p.name}` }).click()
      await expect(page.getByRole('form', { name: `Editar inscrição de ${p.name}` })).toBeVisible()
      await settle(page)
      await expectNoViolations(page, `editar inscrição [${theme}]`)
    })
  }
})
