import type { FastifyInstance } from 'fastify'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { tournamentRegistrationsParamsSchema } from '@birdie-atlas/validators'
import { db } from '../db/index.js'
import { selectRegistrations } from '../db/registrations.js'
import { athleteAffiliations, athletes, clubs, draws, matchResults, matches, tournamentCategories, tournaments } from '../db/schema.js'
import { buildCsv, csvAttachmentHeader } from '../domain/csv.js'
import {
  GENDER_LABELS, MATCH_STATUS_LABELS, formatReportDate, formatReportDateTime, formatScore, joinClubs, matchRoundLabel,
  pickWinner, sortByPlacement, sortMatchesForReport, sortScheduleForReport,
} from '../domain/report-format.js'
import { getWinnerSlot } from '../services/match-result.js'
import { getDefaultTenantId } from '../tenant.js'
import { athleteNames, currentClubNames } from './registrations.js'

// Relatórios em CSV. Só nomes, clube, colocação e placar: nunca e-mail, CPF, telefone ou nascimento.
// Resultados, agenda e classificação são públicos (a chave e o pódio já são); listas de atletas são de admin.

const clubParamsSchema = z.object({ id: z.string().trim().min(1) })

async function loadTournament(rawId: string) {
  const { tournamentId } = tournamentRegistrationsParamsSchema.parse({ tournamentId: rawId })
  const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, tournamentId), isNull(tournaments.deletedAt)))
  return tournament
}

async function loadCategories(tournamentId: string) {
  return db.select().from(tournamentCategories)
    .where(and(eq(tournamentCategories.tournamentId, tournamentId), isNull(tournamentCategories.deletedAt)))
    .orderBy(asc(tournamentCategories.name), asc(tournamentCategories.id))
}

/** Partidas das chaves publicadas do torneio, com o nome de cada lado ("Nome" ou "Nome / Nome"). */
async function loadPublishedMatches(tournamentId: string) {
  const categories = await loadCategories(tournamentId)
  const regs = await selectRegistrations(eq(tournamentCategories.tournamentId, tournamentId), { includeDeleted: true })
  const names = await athleteNames([...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter((v): v is string => !!v)))])
  const sideName = new Map(regs.map((r) => [r.id, [names.get(r.athleteId), r.athlete2Id ? names.get(r.athlete2Id) : null].filter(Boolean).join(' / ')]))

  const categoryIds = categories.map((c) => c.id)
  const drawRows = categoryIds.length ? await db.select().from(draws).where(and(inArray(draws.categoryId, categoryIds), eq(draws.published, true))) : []
  const drawIds = drawRows.map((d) => d.id)
  const matchRows = drawIds.length ? await db.select().from(matches).where(inArray(matches.drawId, drawIds)) : []
  return { categories, drawRows, matchRows, sideName }
}

export async function reportsRoutes(app: FastifyInstance) {
  // Todas as partidas com os dois lados, placar por sets e vencedor (quando os sets o definem).
  app.get('/tournaments/:id/results/export.csv', async (request, reply) => {
    const tournament = await loadTournament((request.params as { id: string }).id)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })

    const { categories, drawRows, matchRows, sideName } = await loadPublishedMatches(tournament.id)
    const setRows = matchRows.length
      ? await db.select().from(matchResults).where(inArray(matchResults.matchId, matchRows.map((m) => m.id))).orderBy(asc(matchResults.setNumber))
      : []
    const setsByMatch = new Map<string, { score1: number; score2: number }[]>()
    for (const s of setRows) setsByMatch.set(s.matchId, [...(setsByMatch.get(s.matchId) ?? []), s])

    const rows = categories.flatMap((category) =>
      drawRows.filter((d) => d.categoryId === category.id).flatMap((draw) =>
        sortMatchesForReport(matchRows.filter((m) => m.drawId === draw.id))
          .map((m) => {
            const sets = setsByMatch.get(m.id) ?? []
            const slot = getWinnerSlot(sets)
            const winnerId = pickWinner(slot, m.registration1Id, m.registration2Id)
            return [
              category.name,
              matchRoundLabel(m),
              m.position,
              m.registration1Id ? (sideName.get(m.registration1Id) ?? '') : '',
              m.registration2Id ? (sideName.get(m.registration2Id) ?? '') : '',
              formatScore(sets),
              winnerId ? (sideName.get(winnerId) ?? '') : '',
              MATCH_STATUS_LABELS[m.status],
              m.courtNumber,
            ]
          }),
      ),
    )

    const csv = buildCsv(['Categoria', 'Fase', 'Partida', 'Lado 1', 'Lado 2', 'Placar', 'Vencedor', 'Situação', 'Quadra'], rows)
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', csvAttachmentHeader(`${tournament.slug}-resultados`))
      .send(csv)
  })

  // Agenda: partidas com horário marcado, por horário e quadra. Pública como a aba Agenda da chave.
  app.get('/tournaments/:id/schedule/export.csv', async (request, reply) => {
    const tournament = await loadTournament((request.params as { id: string }).id)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })

    const { categories, drawRows, matchRows, sideName } = await loadPublishedMatches(tournament.id)
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    const categoryByDraw = new Map(drawRows.map((d) => [d.id, categoryName.get(d.categoryId) ?? '']))
    const scheduled = matchRows.filter((m): m is typeof m & { scheduledAt: Date } => m.scheduledAt !== null)

    const rows = sortScheduleForReport(scheduled).map((m) => [
      formatReportDateTime(m.scheduledAt),
      m.courtNumber,
      categoryByDraw.get(m.drawId) ?? '',
      matchRoundLabel(m),
      m.registration1Id ? (sideName.get(m.registration1Id) ?? '') : '',
      m.registration2Id ? (sideName.get(m.registration2Id) ?? '') : '',
      MATCH_STATUS_LABELS[m.status],
    ])

    const csv = buildCsv(['Horário', 'Quadra', 'Categoria', 'Fase', 'Lado 1', 'Lado 2', 'Situação'], rows)
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', csvAttachmentHeader(`${tournament.slug}-agenda`))
      .send(csv)
  })

  // Classificação final por categoria. `finalPlacement` só existe com o torneio encerrado.
  app.get('/tournaments/:id/standings/export.csv', async (request, reply) => {
    const tournament = await loadTournament((request.params as { id: string }).id)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })

    const categories = await loadCategories(tournament.id)
    const regs = await selectRegistrations(eq(tournamentCategories.tournamentId, tournament.id))
    const placed = regs.filter((r) => r.finalPlacement !== null)
    const ids = [...new Set(placed.flatMap((r) => [r.athleteId, r.athlete2Id].filter((v): v is string => !!v)))]
    const names = await athleteNames(ids)
    const clubs = await currentClubNames(ids)

    const rows = categories.flatMap((category) =>
      sortByPlacement(placed.filter((r) => r.categoryId === category.id))
        .map((r) => {
          return [
            category.name,
            r.finalPlacement,
            names.get(r.athleteId) ?? '',
            r.athlete2Id ? (names.get(r.athlete2Id) ?? '') : '',
            joinClubs([r.athleteId, r.athlete2Id ?? ''].map((id) => clubs.get(id))),
          ]
        }),
    )

    const csv = buildCsv(['Categoria', 'Colocação', 'Atleta', 'Parceiro(a)', 'Clube'], rows)
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', csvAttachmentHeader(`${tournament.slug}-classificacao`))
      .send(csv)
  })

  // Admin (ADMIN_ONLY_READS): cadastro de atletas. Sem ano de nascimento.
  app.get('/athletes/export.csv', async (_request, reply) => {
    const list = await db.select({ id: athletes.id, name: athletes.name, gender: athletes.gender, active: athletes.active })
      .from(athletes).where(and(isNull(athletes.deletedAt), eq(athletes.guest, false))).orderBy(asc(athletes.name), asc(athletes.id))
    const clubs = await currentClubNames(list.map((a) => a.id))
    const csv = buildCsv(
      ['Atleta', 'Gênero', 'Clube', 'Situação'],
      list.map((a) => [a.name, GENDER_LABELS[a.gender], clubs.get(a.id) ?? '', a.active ? 'Ativo' : 'Inativo']),
    )
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', csvAttachmentHeader('atletas'))
      .header('Cache-Control', 'no-store')
      .send(csv)
  })

  // Admin (ADMIN_ONLY_READS): atletas com afiliação ativa no clube. Só nome e data de início.
  app.get('/clubs/:id/athletes/export.csv', async (request, reply) => {
    const { id } = clubParamsSchema.parse(request.params)
    const tenantId = await getDefaultTenantId()
    const [club] = await db.select().from(clubs).where(and(eq(clubs.id, id), eq(clubs.tenantId, tenantId), isNull(clubs.deletedAt)))
    if (!club) return reply.status(404).send({ error: 'Club not found', code: 'CLUB_NOT_FOUND' })

    const list = await db.select({ name: athletes.name, startedAt: athleteAffiliations.startedAt })
      .from(athleteAffiliations)
      .innerJoin(athletes, eq(athletes.id, athleteAffiliations.athleteId))
      .where(and(eq(athleteAffiliations.clubId, club.id), isNull(athleteAffiliations.endedAt), isNull(athletes.deletedAt)))
      .orderBy(asc(athletes.name), asc(athletes.id))
    const csv = buildCsv(['Clube', 'Atleta', 'Afiliado desde'], list.map((a) => [club.name, a.name, formatReportDate(a.startedAt)]))
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', csvAttachmentHeader(`${club.slug}-atletas`))
      .header('Cache-Control', 'no-store')
      .send(csv)
  })
}
