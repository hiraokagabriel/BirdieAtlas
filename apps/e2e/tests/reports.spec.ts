import { expect, test } from '@playwright/test'
import { API_URL } from '../support/env.js'
import { completeTournament, prepareTournament, type PreparedTournament } from '../support/factories.js'

// Relatórios em CSV: resultados e classificação (públicos) e lista de atletas (admin).
// Só nomes, clube, colocação e placar; nunca e-mail nem data de nascimento.

let done: PreparedTournament

test.beforeAll(async () => {
  done = await prepareTournament({ athleteCount: 4 })
  await completeTournament(done)
})

async function csvLines(request: import('@playwright/test').APIRequestContext, path: string): Promise<string[]> {
  const res = await request.get(`${API_URL}${path}`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/csv')
  const bytes = await res.body()
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  return bytes.subarray(3).toString('utf-8').trim().split('\r\n')
}

test.describe('relatórios CSV', () => {
  test('resultados: uma linha por partida, com placar e vencedor', async ({ request }) => {
    const lines = await csvLines(request, `/tournaments/${done.tournament.id}/results/export.csv`)
    expect(lines[0]).toBe('Categoria;Fase;Partida;Lado 1;Lado 2;Placar;Vencedor;Situação;Quadra')
    // 4 atletas: 2 semifinais + final.
    expect(lines).toHaveLength(1 + 3)
    expect(lines[1]).toContain(';Semifinal;')
    expect(lines[3]).toContain(';Final;')
    expect(lines.slice(1).every((l) => l.split(';')[5] !== '')).toBe(true)
  })

  test('resultados: chave não publicada não sai no CSV público', async ({ request }) => {
    const draft = await prepareTournament({ athleteCount: 4, publish: false })
    const lines = await csvLines(request, `/tournaments/${draft.tournament.id}/results/export.csv`)
    expect(lines).toHaveLength(1)
  })

  test('classificação: colocações do pódio em ordem', async ({ request }) => {
    const lines = await csvLines(request, `/tournaments/${done.tournament.id}/standings/export.csv`)
    expect(lines[0]).toBe('Categoria;Colocação;Atleta;Parceiro(a);Clube')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[1]?.split(';')[1]).toBe('1')
  })

  test('torneio inexistente responde 404', async ({ request }) => {
    for (const kind of ['results', 'standings']) {
      const res = await request.get(`${API_URL}/tournaments/nao-existe/${kind}/export.csv`)
      expect(res.status()).toBe(404)
    }
  })

  test('atletas (admin): sem e-mail nem nascimento', async ({ request }) => {
    const lines = await csvLines(request, '/athletes/export.csv')
    expect(lines[0]).toBe('Atleta;Gênero;Clube;Situação')
    expect(lines.join('\n')).not.toMatch(/@/)
  })

  test('o admin baixa resultados e classificação pelos botões do torneio', async ({ page }) => {
    await page.goto(`/admin/tournaments/${done.tournament.id}`)
    for (const [label, suffix] of [['Exportar resultados', /resultados\.csv$/], ['Exportar classificação', /classificacao\.csv$/]] as const) {
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: label }).click()
      expect((await downloadPromise).suggestedFilename()).toMatch(suffix)
    }
  })

  test('o admin baixa a lista de atletas pelo botão', async ({ page }) => {
    await page.goto('/admin/athletes')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar atletas' }).click()
    expect((await downloadPromise).suggestedFilename()).toMatch(/atletas\.csv$/)
  })
})
