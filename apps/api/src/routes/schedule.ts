import type { FastifyInstance } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { autoScheduleBodySchema, utcOffsetMinutesFromIso, type AutoScheduleBody } from '@birdie-atlas/validators'
import { db } from '../db/index.js'
import { matches, tournaments } from '../db/schema.js'
import { loadTournamentMatches } from '../db/tournament-matches.js'
import { planSchedule, resolveDayWindowMinutes, roundLabel, type ScheduleMatch } from '../domain/schedule.js'

// Agenda automática: propõe (dryRun) ou grava (dryRun: false) quadra e horário das partidas do
// torneio. Não há mudança de schema: quadras, início, duração e descanso são parâmetros da chamada.
// Como as rotas vizinhas de torneio (`/tournaments/:id/...`), o torneio não é filtrado por tenant:
// a busca é só por id e `deletedAt`.

type Executor = Pick<typeof db, 'select' | 'update'>

interface SchedulePreviewMatch {
  matchId: string
  categoryId: string
  categoryName: string
  discipline: string
  drawId: string
  round: number
  roundLabel: string
  position: number
  /** Só nomes públicos dos atletas; `null` quando o lado ainda não foi definido. */
  participant1: string | null
  participant2: string | null
}

interface AutoScheduleAssignment extends SchedulePreviewMatch {
  courtNumber: number
  scheduledAt: string
}

interface AutoScheduleUnscheduled extends SchedulePreviewMatch {
  reason: string
}

interface AutoSchedulePayload {
  dryRun: boolean
  applied: boolean
  params: Omit<AutoScheduleBody, 'dryRun'>
  summary: { planned: number; unscheduled: number }
  assignments: AutoScheduleAssignment[]
  unscheduled: AutoScheduleUnscheduled[]
  warnings: string[]
}

type Outcome =
  | { ok: true; payload: AutoSchedulePayload }
  | { ok: false; status: 404 | 409 | 422; error: string; code: string }

async function runAutoSchedule(ex: Executor, tournamentId: string, body: AutoScheduleBody, lock: boolean): Promise<Outcome> {
  const tournamentQuery = ex.select().from(tournaments)
    .where(and(eq(tournaments.id, tournamentId), isNull(tournaments.deletedAt)))
    .$dynamic()
  const [tournament] = await (lock ? tournamentQuery.for('update') : tournamentQuery)
  if (!tournament) return { ok: false, status: 404, error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' }

  if (tournament.status === 'completed' || tournament.status === 'cancelled') {
    const error = tournament.status === 'completed'
      ? 'O torneio está encerrado. Reabra-o para alterar a agenda.'
      : 'O torneio está cancelado e não aceita alterações na agenda.'
    return { ok: false, status: 409, error, code: 'TOURNAMENT_LOCKED' }
  }

  const { categoryByDraw, matchRows, athletesByRegistrationId, participantName } = await loadTournamentMatches(ex, tournamentId)
  if (!matchRows.length) {
    return { ok: false, status: 422, error: 'Nenhuma chave foi gerada neste torneio. Gere as chaves antes de agendar.', code: 'NO_MATCHES' }
  }

  const scheduleMatches: ScheduleMatch[] = matchRows.map((m) => ({
    id: m.id,
    drawId: m.drawId,
    round: m.round,
    position: m.position,
    status: m.status,
    registration1Id: m.registration1Id,
    registration2Id: m.registration2Id,
    nextMatchId: m.nextMatchId,
    scheduledAt: m.scheduledAt,
    courtNumber: m.courtNumber,
  }))

  const result = planSchedule({
    matches: scheduleMatches,
    athletesByRegistrationId,
    courts: body.courts,
    startAt: new Date(body.startAt),
    matchMinutes: body.matchMinutes,
    restMinutes: body.restMinutes,
    reschedule: body.reschedule,
    dayStartsAt: body.dayStartsAt,
    dayEndsAt: body.dayEndsAt,
    utcOffsetMinutes: utcOffsetMinutesFromIso(body.startAt),
  })

  const matchById = new Map(matchRows.map((m) => [m.id, m]))
  const describe = (matchId: string): SchedulePreviewMatch => {
    const match = matchById.get(matchId)!
    const category = categoryByDraw.get(match.drawId)!
    return {
      matchId,
      categoryId: category.id,
      categoryName: category.name,
      discipline: category.discipline,
      drawId: match.drawId,
      round: match.round,
      roundLabel: roundLabel(match.round),
      position: match.position,
      participant1: participantName(match.registration1Id),
      participant2: participantName(match.registration2Id),
    }
  }

  if (!body.dryRun && result.assignments.length) {
    const now = new Date()
    for (const a of result.assignments) {
      await ex.update(matches)
        .set({ scheduledAt: a.scheduledAt, courtNumber: a.courtNumber, updatedAt: now })
        .where(eq(matches.id, a.matchId))
    }
  }

  const { dryRun, ...params } = body
  return {
    ok: true,
    payload: {
      dryRun,
      applied: !dryRun,
      params,
      summary: { planned: result.assignments.length, unscheduled: result.unscheduled.length },
      assignments: result.assignments.map((a) => ({
        ...describe(a.matchId),
        courtNumber: a.courtNumber,
        scheduledAt: a.scheduledAt.toISOString(),
      })),
      unscheduled: result.unscheduled.map((u) => ({ ...describe(u.matchId), reason: u.reason })),
      warnings: result.warnings,
    },
  }
}

export async function scheduleRoutes(app: FastifyInstance) {
  // Autorização é do guard global: é um POST, então exige modo admin também na pré-visualização.
  app.post('/tournaments/:id/schedule/auto', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = autoScheduleBodySchema.parse(request.body ?? {})

    const window = resolveDayWindowMinutes({
      startAt: new Date(body.startAt),
      utcOffsetMinutes: utcOffsetMinutesFromIso(body.startAt),
      dayStartsAt: body.dayStartsAt,
      dayEndsAt: body.dayEndsAt,
    })
    if (window && window.endMin - window.startMin < body.matchMinutes) {
      return reply.status(422).send({
        error: 'A janela diária precisa ser maior que a duração da partida (o início do dia padrão é a hora de início da agenda).',
        code: 'INVALID_DAY_WINDOW',
      })
    }

    // Aplicar lê, planeja e grava na mesma transação, com o torneio travado: a agenda proposta
    // sai do mesmo estado que é gravado, e uma mudança de status concorrente espera ou é recusada.
    const outcome = body.dryRun
      ? await runAutoSchedule(db, id, body, false)
      : await db.transaction((tx) => runAutoSchedule(tx, id, body, true))

    if (!outcome.ok) return reply.status(outcome.status).send({ error: outcome.error, code: outcome.code })
    return outcome.payload
  })
}
