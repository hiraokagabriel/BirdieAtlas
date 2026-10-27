import { expect, test } from '@playwright/test'
import { apiCall } from '../support/api.js'
import { API_URL } from '../support/env.js'
import {
  affiliate,
  completeTournament,
  createAthlete,
  createClub,
  prepareTournament,
  scheduleMatch,
  uniqueTag,
  type Athlete,
  type Club,
  type PreparedTournament,
} from '../support/factories.js'

// Relatórios em CSV (admin): resultados, agenda, colocação final e atletas do clube. O torneio é de simples
// masculino, encerrado pela API (o sorteio é aleatório, então o campeão só é conhecido depois). Todos os
// atletas têm e-mail e data de nascimento, que nunca podem aparecer nas exportações.

const BOM = '﻿'
const BIRTH_DATE = '1990-04-17'
const SCHEDULED_AT = '2026-10-27T17:30:00.000Z'

let prepared: PreparedTournament
let club: Club
let champion: Athlete
let emails: string[]

async function csv(path: string): Promise<{ status: number; headers: Record<string, string>; text: string }> {
  const res = await fetch(`${API_URL}${path}`)
  // `res.text()` descartaria o BOM; ele é parte do contrato do arquivo, então decodifica mantendo-o.
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await res.arrayBuffer())
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text }
}

/** Linhas do CSV sem o BOM nem a linha vazia final; colunas separadas por `;`. */
function parse(text: string): string[][] {
  expect(text.startsWith(BOM)).toBe(true)
  return text.slice(BOM.length).split('\r\n').filter((line) => line !== '').map((line) => line.split(';'))
}

test.beforeAll(async () => {
  const tag = uniqueTag()
  emails = [1, 2, 3, 4].map((n) => `privado.${n}.${tag}@example.com`)
  const athletes = await Promise.all(
    emails.map((email, i) => createAthlete({ name: `Relatório ${i + 1} ${tag}`, gender: 'M', email, birthDate: BIRTH_DATE })),
  )
  prepared = await prepareTournament({ athletes, name: `Relatórios ${tag}` })
  club = await createClub()

  const semifinal = prepared.matches.find((m) => m.round === 2)
  if (!semifinal) throw new Error('A chave de 4 atletas não tem semifinal.')
  await scheduleMatch(semifinal.id, 2, SCHEDULED_AT)
  const report = await completeTournament(prepared)

  const championId = report.report[0]?.podium.find((p) => p.placement === 1)?.athleteId
  const found = athletes.find((a) => a.id === championId)
  if (!found) throw new Error('O encerramento não devolveu o campeão.')
  champion = found
  await affiliate(champion.id, club.id)
})

test.describe('CSV de resultados', () => {
  test('uma linha por partida, da semifinal à final, com placar e vencedor', async () => {
    const res = await csv(`/tournaments/${prepared.tournament.id}/results/export.csv`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="[a-z0-9-]+-resultados\.csv"/)

    const [header, ...rows] = parse(res.text)
    expect(header).toEqual(['Categoria', 'Fase', 'Partida', 'Atleta 1', 'Atleta 2', 'Placar', 'Vencedor', 'Status'])
    expect(rows.map((r) => r[1])).toEqual(['Semifinal', 'Semifinal', 'Final'])
    for (const row of rows) {
      expect(row[5]).toBe('21-15 21-12')
      expect(row[6]).toBe(row[3])
      expect(row[7]).toBe('Encerrada')
    }
    expect(rows[2]?.[6]).toBe(champion.name)
  })

  test('torneio inexistente responde 404', async () => {
    const res = await apiCall<{ code: string }>('GET', '/tournaments/nao-existe/results/export.csv')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('TOURNAMENT_NOT_FOUND')
  })
})

test.describe('CSV da agenda', () => {
  test('só partidas com quadra e horário, no fuso de Brasília', async () => {
    const res = await csv(`/tournaments/${prepared.tournament.id}/schedule/export.csv`)
    expect(res.status).toBe(200)
    const [header, ...rows] = parse(res.text)
    expect(header).toEqual(['Quadra', 'Horário', 'Categoria', 'Fase', 'Atleta 1', 'Atleta 2', 'Status'])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.slice(0, 2)).toEqual(['2', '27/10/2026 14:30'])
    expect(rows[0]?.[3]).toBe('Semifinal')
  })
})

test.describe('CSV da colocação final', () => {
  test('lista o campeão em primeiro, com o clube', async () => {
    const res = await csv(`/tournaments/${prepared.tournament.id}/podium/export.csv`)
    expect(res.status).toBe(200)
    const [header, ...rows] = parse(res.text)
    expect(header).toEqual(['Categoria', 'Colocação', 'Atleta', 'Parceiro(a)', 'Clube'])
    expect(rows.map((r) => r[1])).toEqual(['1', '2', '3', '3'])
    expect(rows[0]?.slice(2)).toEqual([champion.name, '', club.name])
  })

  test('torneio ainda aberto devolve só o cabeçalho', async () => {
    const open = await prepareTournament({ name: `Relatório aberto ${uniqueTag()}` })
    const res = await csv(`/tournaments/${open.tournament.id}/podium/export.csv`)
    expect(res.status).toBe(200)
    expect(parse(res.text)).toHaveLength(1)
  })
})

test.describe('CSV de atletas do clube', () => {
  test('lista só atletas com afiliação ativa, sem dados pessoais', async () => {
    const res = await csv(`/clubs/${club.id}/athletes/export.csv`)
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain(`${club.slug}-atletas.csv`)
    const [header, ...rows] = parse(res.text)
    expect(header).toEqual(['Clube', 'Atleta', 'Afiliado desde'])
    expect(rows).toEqual([[club.name, champion.name, '01/01/2024']])
  })

  test('clube inexistente responde 404', async () => {
    const res = await apiCall<{ code: string }>('GET', '/clubs/nao-existe/athletes/export.csv')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('CLUB_NOT_FOUND')
  })
})

test('nenhum relatório vaza e-mail nem data de nascimento', async () => {
  const paths = [
    `/tournaments/${prepared.tournament.id}/results/export.csv`,
    `/tournaments/${prepared.tournament.id}/schedule/export.csv`,
    `/tournaments/${prepared.tournament.id}/podium/export.csv`,
    `/clubs/${club.id}/athletes/export.csv`,
  ]
  for (const path of paths) {
    const { text } = await csv(path)
    for (const email of emails) expect(text, path).not.toContain(email)
    expect(text, path).not.toContain('@example.com')
    expect(text, path).not.toContain(BIRTH_DATE)
    expect(text, path).not.toContain('1990')
  }
})

test.describe('botões de exportação', () => {
  for (const [label, suffix] of [
    ['Exportar resultados', 'resultados'],
    ['Exportar agenda', 'agenda'],
    ['Exportar colocação', 'colocacao'],
  ] as const) {
    test(`o torneio baixa "${label}"`, async ({ page }) => {
      await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
      await expect(page.getByRole('heading', { name: prepared.tournament.name })).toBeVisible()
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: label }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(new RegExp(`-${suffix}\\.csv$`))
    })
  }

  test('o clube baixa "Exportar atletas"', async ({ page }) => {
    await page.goto(`/admin/clubs/${club.id}`)
    await expect(page.getByRole('heading', { name: club.name })).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar atletas' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(`${club.slug}-atletas.csv`)
  })
})
