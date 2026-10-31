import type { FastifyInstance } from 'fastify'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { publicAthleteColumns } from '../db/public-columns.js'
import { selectRegistrations } from '../db/registrations.js'
import {
  athletes, draws, matchResults, matches, pairs, tournamentCategories, tournamentRegistrations, tournaments,
} from '../db/schema.js'
import { longestWinStreak, resultFor, scoreFor, summarize, type MatchRecord } from '../domain/athlete-stats.js'
import { matchRoundLabel } from '../domain/schedule.js'

// Estatísticas públicas de partidas e confronto direto. Só nomes, torneios, placares e colocações:
// nada de e-mail, nascimento ou outros dados pessoais (mesma regra do perfil público).

const FINISHED = ['completed', 'walkover', 'retired'] as const

interface PlayedMatch extends MatchRecord {
  matchId: string
  tournamentId: string
  tournamentName: string
  tournamentSlug: string
  tournamentDate: string
  categoryName: string
  roundLabel: string
  updatedAt: Date
  /** Atletas do lado contrário. */
  opponentAthleteIds: string[]
  partnerAthleteIds: string[]
}

async function publicAthlete(id: string) {
  const [athlete] = await db.select(publicAthleteColumns).from(athletes)
    .where(and(eq(athletes.id, id), isNull(athletes.deletedAt)))
  return athlete ? { id: athlete.id, name: athlete.name } : undefined
}

/** Partidas encerradas do atleta (simples ou em qualquer dupla), da mais recente para a mais antiga. */
async function loadPlayedMatches(athleteId: string): Promise<{ played: PlayedMatch[]; placements: (number | null)[] }> {
  const myPairs = await db.select({ id: pairs.id }).from(pairs)
    .where(or(eq(pairs.athlete1Id, athleteId), eq(pairs.athlete2Id, athleteId)))
  const pairIds = myPairs.map((p) => p.id)
  const regs = await selectRegistrations(
    or(eq(tournamentRegistrations.athleteId, athleteId), pairIds.length ? inArray(tournamentRegistrations.pairId, pairIds) : undefined),
    { includeDeleted: true },
  )
  const placements = regs.map((r) => r.finalPlacement)
  const regById = new Map(regs.map((r) => [r.id, r]))
  if (!regs.length) return { played: [], placements }

  const regIds = regs.map((r) => r.id)
  const matchRows = await db.select().from(matches).where(and(
    or(inArray(matches.registration1Id, regIds), inArray(matches.registration2Id, regIds)),
    inArray(matches.status, [...FINISHED]),
  ))
  if (!matchRows.length) return { played: [], placements }

  const setRows = await db.select().from(matchResults)
    .where(inArray(matchResults.matchId, matchRows.map((m) => m.id)))
  const setsByMatch = new Map<string, { score1: number; score2: number; setNumber: number }[]>()
  for (const s of setRows) setsByMatch.set(s.matchId, [...(setsByMatch.get(s.matchId) ?? []), s])

  const drawRows = await db.select().from(draws).where(inArray(draws.id, [...new Set(matchRows.map((m) => m.drawId))]))
  const categoryRows = await db.select().from(tournamentCategories)
    .where(inArray(tournamentCategories.id, [...new Set(drawRows.map((d) => d.categoryId))]))
  // Torneio excluído ou ainda em rascunho não é público.
  const tournamentRows = (await db.select().from(tournaments)
    .where(and(inArray(tournaments.id, [...new Set(categoryRows.map((c) => c.tournamentId))]), isNull(tournaments.deletedAt))))
    .filter((t) => t.status !== 'draft')
  const drawById = new Map(drawRows.map((d) => [d.id, d]))
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]))
  const tournamentById = new Map(tournamentRows.map((t) => [t.id, t]))

  const opponentRegIds = [...new Set(matchRows.flatMap((m) => [m.registration1Id, m.registration2Id])
    .filter((v): v is string => v !== null && !regById.has(v)))]
  const opponentRegs = opponentRegIds.length
    ? await selectRegistrations(inArray(tournamentRegistrations.id, opponentRegIds), { includeDeleted: true })
    : []
  const opponentById = new Map(opponentRegs.map((r) => [r.id, r]))

  const athletesOf = (reg: { athleteId: string; athlete2Id: string | null } | undefined): string[] =>
    reg ? [reg.athleteId, reg.athlete2Id].filter((v): v is string => v !== null) : []

  const played: PlayedMatch[] = []
  for (const m of matchRows) {
    const side: 1 | 2 = m.registration1Id && regById.has(m.registration1Id) ? 1 : 2
    const mine = regById.get((side === 1 ? m.registration1Id : m.registration2Id) ?? '')
    const otherId = side === 1 ? m.registration2Id : m.registration1Id
    if (!mine || !otherId) continue // bye: sem adversário

    const draw = drawById.get(m.drawId)
    const category = draw ? categoryById.get(draw.categoryId) : undefined
    const tournament = category ? tournamentById.get(category.tournamentId) : undefined
    if (!tournament || !category) continue

    played.push({
      side,
      sets: (setsByMatch.get(m.id) ?? []).sort((a, b) => a.setNumber - b.setNumber),
      matchId: m.id,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      tournamentDate: String(tournament.startDate),
      categoryName: category.name,
      roundLabel: matchRoundLabel(m),
      updatedAt: m.updatedAt,
      opponentAthleteIds: athletesOf(opponentById.get(otherId) ?? regById.get(otherId)),
      partnerAthleteIds: athletesOf(mine).filter((id) => id !== athleteId),
    })
  }
  played.sort((a, b) => b.tournamentDate.localeCompare(a.tournamentDate) || b.updatedAt.getTime() - a.updatedAt.getTime())
  return { played, placements }
}

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const rows = await db.select({ id: athletes.id, name: athletes.name }).from(athletes).where(inArray(athletes.id, ids))
  return new Map(rows.map((a) => [a.id, a.name]))
}

const idParams = z.object({ id: z.string().trim().min(1) })
const h2hParams = z.object({ id: z.string().trim().min(1), opponentId: z.string().trim().min(1) })

export async function athleteStatsRoutes(app: FastifyInstance) {
  app.get('/athletes/:id/stats', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const athlete = await publicAthlete(id)
    if (!athlete) return reply.status(404).send({ error: 'Athlete not found', code: 'ATHLETE_NOT_FOUND' })

    const { played, placements } = await loadPlayedMatches(id)
    const summary = summarize(played)
    const chronological = [...played].reverse().map(resultFor)

    const recent = played.filter((m) => resultFor(m) !== null).slice(0, 5)
    const names = await namesOf([...new Set(recent.flatMap((m) => m.opponentAthleteIds))])

    return {
      summary,
      longestWinStreak: longestWinStreak(chronological),
      titles: placements.filter((p) => p === 1).length,
      finals: placements.filter((p) => p === 2).length,
      podiums: placements.filter((p) => p !== null && p <= 3).length,
      recent: recent.map((m) => ({
        matchId: m.matchId,
        result: resultFor(m),
        score: scoreFor(m),
        tournamentName: m.tournamentName,
        tournamentSlug: m.tournamentSlug,
        categoryName: m.categoryName,
        roundLabel: m.roundLabel,
        opponents: m.opponentAthleteIds.map((oid) => ({ id: oid, name: names.get(oid) ?? '' })),
      })),
    }
  })

  app.get('/athletes/:id/head-to-head/:opponentId', async (request, reply) => {
    const { id, opponentId } = h2hParams.parse(request.params)
    if (id === opponentId) {
      return reply.status(400).send({ error: 'Escolha outro atleta para comparar.', code: 'SAME_ATHLETE' })
    }
    const [athlete, opponent] = await Promise.all([publicAthlete(id), publicAthlete(opponentId)])
    if (!athlete || !opponent) return reply.status(404).send({ error: 'Athlete not found', code: 'ATHLETE_NOT_FOUND' })

    const { played } = await loadPlayedMatches(id)
    const against = played.filter((m) => m.opponentAthleteIds.includes(opponentId))
    const partnerNames = await namesOf([...new Set(against.flatMap((m) => m.partnerAthleteIds))])

    return {
      athlete,
      opponent,
      summary: summarize(against),
      matches: against.map((m) => ({
        matchId: m.matchId,
        result: resultFor(m),
        score: scoreFor(m),
        tournamentName: m.tournamentName,
        tournamentSlug: m.tournamentSlug,
        tournamentDate: m.tournamentDate,
        categoryName: m.categoryName,
        roundLabel: m.roundLabel,
        partners: m.partnerAthleteIds.map((pid) => partnerNames.get(pid) ?? ''),
      })),
    }
  })
}
