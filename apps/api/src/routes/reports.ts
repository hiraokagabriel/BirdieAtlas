import type { FastifyInstance, FastifyReply } from 'fastify'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { athleteNames, currentClubNames, selectRegistrations } from '../db/registrations.js'
import {
  athleteAffiliations, athletes, clubs, matchResults, tournamentCategories, tournaments,
} from '../db/schema.js'
import { loadTournamentMatches } from '../db/tournament-matches.js'
import { buildCsv, csvAttachmentHeader } from '../domain/csv.js'
import {
  CLUB_ATHLETES_HEADER, PODIUM_HEADER, RESULTS_HEADER, SCHEDULE_HEADER,
  clubAthletesRows, podiumRows, resultsRows, scheduleRows,
  type ReportMatch,
} from '../domain/reports.js'
import { getDefaultTenantId } from '../tenant.js'

// Relatórios em CSV (admin, via ADMIN_ONLY_READS). Só nomes, clube e dados esportivos: nunca
// e-mail, CPF, telefone, nascimento nem `notes`. Formato e cabeçalhos: `domain/csv.ts`.

const idParamsSchema = z.object({ id: z.string().min(1) })

function sendCsv(reply: FastifyReply, baseName: string, csv: string) {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', csvAttachmentHeader(baseName))
    .header('Cache-Control', 'no-store')
    .send(csv)
}

async function loadTournament(id: string) {
  const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
  return tournament
}

/** Partidas do torneio com sets e nomes, no formato dos relatórios. */
async function loadReportMatches(tournamentId: string): Promise<ReportMatch[]> {
  const { categoryByDraw, matchRows, participantName } = await loadTournamentMatches(db, tournamentId)
  const results = matchRows.length
    ? await db.select().from(matchResults).where(inArray(matchResults.matchId, matchRows.map((m) => m.id)))
    : []
  const setsByMatch = new Map<string, typeof results>()
  for (const r of results) setsByMatch.set(r.matchId, [...(setsByMatch.get(r.matchId) ?? []), r])
  return matchRows.map((m) => ({
    categoryName: categoryByDraw.get(m.drawId)?.name ?? '',
    round: m.round,
    position: m.position,
    participant1: participantName(m.registration1Id),
    participant2: participantName(m.registration2Id),
    status: m.status,
    sets: setsByMatch.get(m.id) ?? [],
    scheduledAt: m.scheduledAt,
    courtNumber: m.courtNumber,
  }))
}

export async function reportsRoutes(app: FastifyInstance) {
  app.get('/tournaments/:id/results/export.csv', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const tournament = await loadTournament(id)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    const csv = buildCsv(RESULTS_HEADER, resultsRows(await loadReportMatches(id)))
    return sendCsv(reply, `${tournament.slug}-resultados`, csv)
  })

  app.get('/tournaments/:id/schedule/export.csv', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const tournament = await loadTournament(id)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    const csv = buildCsv(SCHEDULE_HEADER, scheduleRows(await loadReportMatches(id)))
    return sendCsv(reply, `${tournament.slug}-agenda`, csv)
  })

  // Colocação final gravada no encerramento: torneio ainda aberto devolve só o cabeçalho.
  app.get('/tournaments/:id/podium/export.csv', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const tournament = await loadTournament(id)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })

    const categories = await db.select().from(tournamentCategories)
      .where(and(eq(tournamentCategories.tournamentId, id), isNull(tournamentCategories.deletedAt)))
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    // Categoria excluída fica de fora: `selectRegistrations` não a filtra e a linha sairia sem nome de categoria.
    const placed = (await selectRegistrations(eq(tournamentCategories.tournamentId, id)))
      .filter((r) => r.finalPlacement !== null && categoryName.has(r.categoryId))
    const athleteIds = [...new Set(placed.flatMap((r) => [r.athleteId, r.athlete2Id].filter((v): v is string => v !== null)))]
    const names = await athleteNames(athleteIds)
    const clubNames = await currentClubNames(athleteIds)

    const rows = podiumRows(placed.map((r) => {
      const members = [r.athleteId, r.athlete2Id].filter((v): v is string => v !== null)
      const clubList = [...new Set(members.map((a) => clubNames.get(a)).filter((v): v is string => !!v))]
      return {
        categoryName: categoryName.get(r.categoryId) ?? '',
        placement: r.finalPlacement!,
        athlete: names.get(r.athleteId) ?? '',
        partner: r.athlete2Id ? (names.get(r.athlete2Id) ?? '') : null,
        club: clubList.join(' / '),
      }
    }))
    return sendCsv(reply, `${tournament.slug}-colocacao`, buildCsv(PODIUM_HEADER, rows))
  })

  // Atletas com afiliação ativa no clube (sem data de término) e atleta não excluído.
  app.get('/clubs/:id/athletes/export.csv', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    const tenantId = await getDefaultTenantId()
    const [club] = await db.select().from(clubs)
      .where(and(eq(clubs.id, id), eq(clubs.tenantId, tenantId), isNull(clubs.deletedAt)))
    if (!club) return reply.status(404).send({ error: 'Club not found', code: 'CLUB_NOT_FOUND' })

    const rows = await db
      .select({ athlete: athletes.name, startedAt: athleteAffiliations.startedAt })
      .from(athleteAffiliations)
      .innerJoin(athletes, eq(athletes.id, athleteAffiliations.athleteId))
      .where(and(eq(athleteAffiliations.clubId, id), isNull(athleteAffiliations.endedAt), isNull(athletes.deletedAt)))
      .orderBy(asc(athletes.name))
    const csv = buildCsv(CLUB_ATHLETES_HEADER, clubAthletesRows(rows.map((r) => ({ clubName: club.name, ...r }))))
    return sendCsv(reply, `${club.slug}-atletas`, csv)
  })
}
