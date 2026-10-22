import { expect, test } from '@playwright/test'
import { apiCall } from '../support/api.js'
import { listMatches, prepareTournament, type Match, type PreparedTournament } from '../support/factories.js'

// Agenda automática: pré-visualizar (não grava), aplicar e conferir pela API que nenhum atleta joga duas
// partidas sobrepostas nem sem o descanso mínimo. Parâmetros fixos: 2 quadras, 40 min por partida, 15 de descanso.

const MATCH_MINUTES = 40
const REST_MINUTES = 15
const MINUTE = 60_000

let prepared: PreparedTournament

test.beforeAll(async () => {
  // 8 atletas: 4 quartas, 2 semifinais e a final (7 partidas).
  prepared = await prepareTournament({ athleteCount: 8, name: `Agenda E2E ${Date.now().toString(36)}` })
})

function startOf(match: Match): number {
  if (!match.scheduledAt) throw new Error(`Partida ${match.id} sem horário.`)
  return new Date(match.scheduledAt).getTime()
}

/**
 * Cada atleta pode jogar a sua partida da primeira fase e, avançando, todas as seguintes (`nextMatchId`).
 * A regra da especificação é conservadora: essas partidas nunca se sobrepõem e respeitam o descanso.
 */
function assertNoAthleteConflicts(matches: readonly Match[]): void {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const firstRound = matches.filter((m) => m.round === Math.max(...matches.map((x) => x.round)))

  for (const first of firstRound) {
    const path: Match[] = []
    for (let current: Match | undefined = first; current; current = current.nextMatchId ? byId.get(current.nextMatchId) : undefined) {
      path.push(current)
    }
    for (let i = 1; i < path.length; i++) {
      const previous = path[i - 1]
      const next = path[i]
      if (!previous || !next) continue
      const gap = startOf(next) - startOf(previous)
      expect(gap, `partida ${next.id} começa cedo demais depois de ${previous.id}`).toBeGreaterThanOrEqual(
        (MATCH_MINUTES + REST_MINUTES) * MINUTE,
      )
    }
  }
}

function assertNoCourtOverlap(matches: readonly Match[]): void {
  const byCourt = new Map<number, Match[]>()
  for (const match of matches) {
    if (match.courtNumber === null) throw new Error(`Partida ${match.id} sem quadra.`)
    byCourt.set(match.courtNumber, [...(byCourt.get(match.courtNumber) ?? []), match])
  }
  for (const [court, list] of byCourt) {
    const sorted = [...list].sort((a, b) => startOf(a) - startOf(b))
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1]
      const next = sorted[i]
      if (!previous || !next) continue
      expect(startOf(next) - startOf(previous), `quadra ${court} ocupada`).toBeGreaterThanOrEqual(MATCH_MINUTES * MINUTE)
    }
  }
}

test('pré-visualiza sem gravar, aplica e a agenda respeita atletas e quadras', async ({ page }) => {
  await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
  await page.getByRole('tab', { name: 'Agenda', exact: true }).click()
  await expect(page.getByText('Sem horário definido')).toBeVisible()

  await page.getByRole('button', { name: 'Gerar agenda automática' }).click()
  const dialog = page.getByRole('dialog', { name: 'Gerar agenda automática' })
  await expect(dialog.getByLabel('Quadras')).toHaveValue('2')
  await expect(dialog.getByLabel('Duração da partida (min)')).toHaveValue(String(MATCH_MINUTES))
  await expect(dialog.getByLabel('Descanso entre partidas (min)')).toHaveValue(String(REST_MINUTES))
  await expect(dialog.getByRole('button', { name: 'Aplicar agenda' })).toBeDisabled() // sem pré-visualização ainda

  // Pré-visualização: mostra a proposta por quadra e não grava nada.
  await dialog.getByRole('button', { name: 'Pré-visualizar' }).click()
  await expect(dialog.getByText(/7 partidas planejadas/)).toBeVisible()
  await expect(dialog.getByRole('columnheader', { name: 'Quadra 1' }).first()).toBeVisible()
  await expect(dialog.getByRole('columnheader', { name: 'Quadra 2' }).first()).toBeVisible()
  await expect(dialog.getByText('Quartas de final').first()).toBeVisible()
  const afterPreview = await listMatches(prepared.draw.id)
  expect(afterPreview.every((m) => m.scheduledAt === null && m.courtNumber === null)).toBe(true)

  // Aplicar grava exatamente a proposta.
  await dialog.getByRole('button', { name: 'Aplicar agenda' }).click()
  await expect(dialog.getByText('Agenda aplicada: 7 partidas agendadas.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(dialog).toBeHidden()

  const scheduled = await listMatches(prepared.draw.id)
  expect(scheduled).toHaveLength(7)
  for (const match of scheduled) {
    expect(match.scheduledAt, `partida ${match.id}`).not.toBeNull()
    expect([1, 2]).toContain(match.courtNumber)
  }
  assertNoAthleteConflicts(scheduled)
  assertNoCourtOverlap(scheduled)

  // A aba Agenda passa a mostrar horários e quadras.
  await expect(page.getByText('Sem horário definido')).toHaveCount(0)
  await expect(page.getByText('Quadra 1').first()).toBeVisible()
  await expect(page.getByText('Quadra 2').first()).toBeVisible()
})

test('com tudo agendado, uma nova pré-visualização não tem partidas para planejar', async ({ page }) => {
  // Idempotência: depois de aplicada a agenda (teste anterior ou a chamada abaixo), nada fica pendente sem horário.
  const matches = await listMatches(prepared.draw.id)
  if (matches.some((m) => m.scheduledAt === null)) {
    const applied = await apiCall('POST', `/tournaments/${prepared.tournament.id}/schedule/auto`, {
      courts: 2,
      startAt: '2098-03-10T09:00:00-03:00',
      matchMinutes: MATCH_MINUTES,
      restMinutes: REST_MINUTES,
      dryRun: false,
    })
    expect(applied.ok).toBe(true)
  }

  await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
  await page.getByRole('tab', { name: 'Agenda', exact: true }).click()
  await page.getByRole('button', { name: 'Gerar agenda automática' }).click()
  const dialog = page.getByRole('dialog', { name: 'Gerar agenda automática' })
  await dialog.getByRole('button', { name: 'Pré-visualizar' }).click()
  await expect(dialog.getByText('Nenhuma partida para agendar')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Aplicar agenda' })).toBeDisabled()

  // «Reagendar» refaz a agenda e a regra continua valendo.
  await dialog.getByLabel(/Reagendar partidas já agendadas/).check()
  await dialog.getByRole('button', { name: 'Pré-visualizar' }).click()
  await expect(dialog.getByText(/7 partidas planejadas/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Aplicar agenda' }).click()
  await expect(dialog.getByText('Agenda aplicada: 7 partidas agendadas.')).toBeVisible()
  const rescheduled = await listMatches(prepared.draw.id)
  assertNoAthleteConflicts(rescheduled)
  assertNoCourtOverlap(rescheduled)
})

test('valida os parâmetros do formulário antes de chamar a API', async ({ page }) => {
  await page.goto(`/admin/tournaments/${prepared.tournament.id}`)
  await page.getByRole('tab', { name: 'Agenda', exact: true }).click()
  await page.getByRole('button', { name: 'Gerar agenda automática' }).click()
  const dialog = page.getByRole('dialog', { name: 'Gerar agenda automática' })

  await dialog.getByLabel('Quadras').fill('0')
  await dialog.getByRole('button', { name: 'Pré-visualizar' }).click()
  await expect(dialog.getByLabel('Quadras')).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByText(/partidas planejadas/)).toHaveCount(0)
})

test('abrir a aba Agenda antes de as categorias chegarem não deixa a lista vazia', async ({ page }) => {
  // As categorias vêm numa segunda chamada; atrasá-la reproduz o clique rápido na aba (a lista ficava vazia para sempre).
  const own = await prepareTournament({ athleteCount: 4, name: `Agenda Tardia ${Date.now().toString(36)}` })
  await page.route('**/tournaments/*/categories', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.continue()
  })
  await page.goto(`/admin/tournaments/${own.tournament.id}`)
  await page.getByRole('tab', { name: 'Agenda', exact: true }).click()
  await expect(page.getByText('Sem horário definido')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Nenhuma partida encontrada')).toHaveCount(0)
})
