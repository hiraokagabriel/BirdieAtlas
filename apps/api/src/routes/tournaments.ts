import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import {
  tournaments, tournamentCategories, tournamentRegistrations,
  draws, matches, matchResults, athletes,
  rankings, rankingEntries, rankingTournaments,
} from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const createTournamentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  tenantId: z.string(),
  level: z.string().default('estadual'),
  city: z.string().optional(),
  state: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  registrationDeadline: z.string().optional(),
  pointsTableId: z.string().optional(),
})

const createCategorySchema = z.object({
  name: z.string().min(1),
  discipline: z.enum(['MS', 'WS', 'MD', 'WD', 'XD']),
  maxEntries: z.number().int().optional(),
})

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}

// ---------------------------------------------------------------------------
// Recalcula um ranking removendo as entradas e reinserindo sem o torneio dado
// ---------------------------------------------------------------------------
async function removePointsFromRanking(rankingId: string, tournamentId: string) {
  const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
  if (!ranking) return

  // Busca todos os torneios que alimentam este ranking (excluindo o reaberto)
  let tournamentIds: string[] = []
  if (ranking.autoInclude) {
    const all = await db.select().from(tournaments)
      .where(and(eq(tournaments.tenantId, ranking.tenantId), eq(tournaments.pointsAwarded, true)))
    tournamentIds = all.map((t) => t.id).filter((id) => id !== tournamentId)
  } else {
    const links = await db.select().from(rankingTournaments)
      .where(eq(rankingTournaments.rankingId, rankingId))
    tournamentIds = links.map((l) => l.tournamentId).filter((id) => id !== tournamentId)
  }

  // Limpa entradas atuais do ranking
  await db.delete(rankingEntries).where(eq(rankingEntries.rankingId, rankingId))

  if (!tournamentIds.length) return

  // Reacumula pontos apenas dos torneios restantes
  const { pointsTables } = await import('../db/schema')
  const DOUBLES = new Set(['MD', 'WD', 'XD'])
  const isDoubles = DOUBLES.has(ranking.discipline)

  const pointsAcc = new Map<string, { athleteId: string; athlete2Id: string | null; points: number }>()

  for (const tId of tournamentIds) {
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tId))
    if (!t?.pointsTableId) continue
    const [refTable] = await db.select().from(pointsTables).where(eq(pointsTables.id, t.pointsTableId))
    if (!refTable) continue

    const allPointsRows = await db.select().from(pointsTables)
      .where(and(eq(pointsTables.name, refTable.name), eq(pointsTables.tournamentLevel, t.level)))
    const pointsMap = new Map(allPointsRows.map((p) => [p.placement, p.points]))

    const categories = await db.select().from(tournamentCategories)
      .where(and(
        eq(tournamentCategories.tournamentId, tId),
        eq(tournamentCategories.discipline, ranking.discipline as 'MS' | 'WS' | 'MD' | 'WD' | 'XD'),
      ))

    for (const cat of categories) {
      const drawList = await db.select().from(draws).where(eq(draws.categoryId, cat.id))
      if (!drawList.length) continue
      const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawList[0].id))
      const pending = allMatches.filter((m) => !['completed', 'walkover', 'retired'].includes(m.status))
      if (pending.length) continue

      const placementByReg = new Map<string, number>()
      for (const match of allMatches) {
        const sets = await db.select().from(matchResults).where(eq(matchResults.matchId, match.id))
        if (!sets.length) continue
        const winner = getWinnerSlot(sets)
        if (!winner) continue
        const loserRegId  = winner === 1 ? match.registration2Id : match.registration1Id
        const winnerRegId = winner === 1 ? match.registration1Id : match.registration2Id
        const loserPlacement = match.round === 1 ? 2 : Math.pow(2, match.round - 1) + 1
        if (loserRegId) placementByReg.set(loserRegId, loserPlacement)
        if (match.round === 1 && winnerRegId) placementByReg.set(winnerRegId, 1)
      }

      const regIds = [...placementByReg.keys()]
      if (!regIds.length) continue
      const regs = await db.select().from(tournamentRegistrations).where(inArray(tournamentRegistrations.id, regIds))
      const aIds = [...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
      const athleteRows = aIds.length ? await db.select().from(athletes).where(inArray(athletes.id, aIds)) : []
      const athleteMap = new Map(athleteRows.map((a) => [a.id, a]))

      for (const [regId, placement] of placementByReg.entries()) {
        const reg = regs.find((r) => r.id === regId)
        if (!reg) continue
        const pts = pointsMap.get(placement) ?? 0
        if (pts === 0) continue
        if (isDoubles) {
          if (!reg.athlete2Id) continue
          const [a, b] = reg.athleteId < reg.athlete2Id ? [reg.athleteId, reg.athlete2Id] : [reg.athlete2Id, reg.athleteId]
          const key = `${a}::${b}`
          const cur = pointsAcc.get(key) ?? { athleteId: a, athlete2Id: b, points: 0 }
          cur.points += pts; pointsAcc.set(key, cur)
        } else {
          const key = reg.athleteId
          const cur = pointsAcc.get(key) ?? { athleteId: reg.athleteId, athlete2Id: null, points: 0 }
          cur.points += pts; pointsAcc.set(key, cur)
        }
      }
    }
  }

  const sorted = [...pointsAcc.values()].sort((a, b) => b.points - a.points)
  if (sorted.length) {
    await db.insert(rankingEntries).values(
      sorted.map((e, i) => ({ id: randomUUID(), rankingId, athleteId: e.athleteId, athlete2Id: e.athlete2Id, points: e.points, position: i + 1 }))
    )
  }
}

export async function tournamentsRoutes(app: FastifyInstance) {
  app.get('/tournaments', async (request) => {
    const { tenantId } = request.query as { tenantId?: string }
    if (tenantId) return db.select().from(tournaments).where(eq(tournaments.tenantId, tenantId))
    return db.select().from(tournaments)
  })

  app.get('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id))
    if (!t) return reply.status(404).send({ error: 'Tournament not found' })
    return t
  })

  app.get('/tournaments/by-slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const [t] = await db.select().from(tournaments).where(eq(tournaments.slug, slug))
    if (!t) return reply.status(404).send({ error: 'Tournament not found' })
    return t
  })

  app.get('/tournaments/:id/categories', async (request) => {
    const { id } = request.params as { id: string }
    return db.select().from(tournamentCategories).where(eq(tournamentCategories.tournamentId, id))
  })

  // Registrations enriquecidas com nome dos atletas
  app.get('/tournaments/categories/:categoryId/registrations', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    const regs = await db.select().from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.categoryId, categoryId))

    if (!regs.length) return []

    const athleteIds = [...new Set(
      regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[])
    )]
    const athleteRows = await db.select().from(athletes).where(inArray(athletes.id, athleteIds))
    const athleteMap = new Map(athleteRows.map((a) => [a.id, a.name]))

    return regs.map((r) => ({
      ...r,
      athleteName: athleteMap.get(r.athleteId) ?? null,
      athlete2Name: r.athlete2Id ? (athleteMap.get(r.athlete2Id) ?? null) : null,
    }))
  })

  app.post('/tournaments', async (request, reply) => {
    const body = createTournamentSchema.parse(request.body)
    const [t] = await db.insert(tournaments).values({ id: randomUUID(), status: 'draft', ...body }).returning()
    return reply.status(201).send(t)
  })

  app.post('/tournaments/:id/categories', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createCategorySchema.parse(request.body)
    const [cat] = await db.insert(tournamentCategories).values({ id: randomUUID(), tournamentId: id, ...body }).returning()
    return reply.status(201).send(cat)
  })

  app.post('/tournaments/categories/:categoryId/register', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const body = (request.body as { athleteId: string; athlete2Id?: string; seed?: number; rankingPointsAtEntry?: number })
    const [cat] = await db.select().from(tournamentCategories).where(eq(tournamentCategories.id, categoryId))
    if (!cat) return reply.status(404).send({ error: 'Category not found' })
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, cat.tournamentId))
    if (t?.status === 'completed') return reply.status(400).send({ error: 'Tournament is finished. No new registrations allowed.' })
    const [reg] = await db.insert(tournamentRegistrations).values({
      id: randomUUID(), categoryId, ...body, confirmed: false, withdrew: false,
    }).returning()
    return reply.status(201).send(reg)
  })

  app.put('/tournaments/registrations/:registrationId/confirm', async (request, reply) => {
    const { registrationId } = request.params as { registrationId: string }
    const [reg] = await db.update(tournamentRegistrations)
      .set({ confirmed: true, updatedAt: new Date() })
      .where(eq(tournamentRegistrations.id, registrationId))
      .returning()
    if (!reg) return reply.status(404).send({ error: 'Registration not found' })
    return reg
  })

  app.put('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createTournamentSchema.partial().parse(request.body)
    const [t] = await db.update(tournaments).set({ ...body, updatedAt: new Date() }).where(eq(tournaments.id, id)).returning()
    if (!t) return reply.status(404).send({ error: 'Tournament not found' })
    return t
  })

  // ---------------------------------------------------------------------------
  // POST /tournaments/:id/finalize
  // ---------------------------------------------------------------------------
  app.post('/tournaments/:id/finalize', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    if (tournament.status === 'completed') return reply.status(409).send({ error: 'Tournament already finished' })

    const categories = await db.select().from(tournamentCategories).where(eq(tournamentCategories.tournamentId, id))
    if (!categories.length) return reply.status(400).send({ error: 'No categories found' })

    const incomplete: string[] = []
    for (const cat of categories) {
      const drawList = await db.select().from(draws).where(eq(draws.categoryId, cat.id))
      if (!drawList.length) { incomplete.push(`${cat.name}: chave não gerada`); continue }
      const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawList[0].id))
      const pending = allMatches.filter((m) => !['completed', 'walkover', 'retired'].includes(m.status))
      if (pending.length > 0) incomplete.push(`${cat.name}: ${pending.length} partida(s) pendente(s)`)
    }
    if (incomplete.length > 0) {
      return reply.status(400).send({ error: 'Não é possível encerrar: existem chaves incompletas.', incomplete })
    }

    const report: {
      categoryId: string; categoryName: string; discipline: string
      podium: { placement: number; medal: string; athleteId: string; athleteName: string; athlete2Id: string | null; athlete2Name: string | null }[]
    }[] = []

    for (const cat of categories) {
      const drawList = await db.select().from(draws).where(eq(draws.categoryId, cat.id))
      const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawList[0].id))

      const placementByReg = new Map<string, number>()
      for (const match of allMatches) {
        const sets = await db.select().from(matchResults).where(eq(matchResults.matchId, match.id))
        if (!sets.length) continue
        const winner = getWinnerSlot(sets)
        if (!winner) continue
        const loserRegId  = winner === 1 ? match.registration2Id : match.registration1Id
        const winnerRegId = winner === 1 ? match.registration1Id : match.registration2Id
        const loserPlacement = match.round === 1 ? 2 : Math.pow(2, match.round - 1) + 1
        if (loserRegId) placementByReg.set(loserRegId, loserPlacement)
        if (match.round === 1 && winnerRegId) placementByReg.set(winnerRegId, 1)
      }

      const top4 = [...placementByReg.entries()].sort((a, b) => a[1] - b[1]).slice(0, 4)
      if (!top4.length) continue

      const regIds = top4.map(([regId]) => regId)
      const regs = await db.select().from(tournamentRegistrations).where(inArray(tournamentRegistrations.id, regIds))
      const athleteIds = [...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
      const athleteRows = athleteIds.length ? await db.select().from(athletes).where(inArray(athletes.id, athleteIds)) : []
      const athleteMap = new Map(athleteRows.map((a) => [a.id, a.name]))

      const medals = ['🥇', '🥈', '🥉', '4º']
      const podium = top4.map(([regId, placement]) => {
        const reg = regs.find((r) => r.id === regId)
        return {
          placement, medal: medals[placement - 1] ?? `${placement}º`,
          athleteId: reg?.athleteId ?? '',
          athleteName: reg ? (athleteMap.get(reg.athleteId) ?? '—') : '—',
          athlete2Id: reg?.athlete2Id ?? null,
          athlete2Name: reg?.athlete2Id ? (athleteMap.get(reg.athlete2Id) ?? null) : null,
        }
      })
      report.push({ categoryId: cat.id, categoryName: cat.name, discipline: cat.discipline, podium })
    }

    await db.update(tournaments).set({ status: 'completed', updatedAt: new Date() }).where(eq(tournaments.id, id))
    return { message: 'Torneio encerrado com sucesso.', report }
  })

  // ---------------------------------------------------------------------------
  // POST /tournaments/:id/reopen
  // Reverte pontos distribuídos, reseta pointsAwarded e volta para in_progress
  // ---------------------------------------------------------------------------
  app.post('/tournaments/:id/reopen', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    if (tournament.status !== 'completed') {
      return reply.status(409).send({ error: 'Only completed tournaments can be reopened' })
    }

    // Se pontos foram distribuídos, reverte antes de reabrir
    if (tournament.pointsAwarded) {
      // Rankings autoInclude do mesmo tenant
      const autoRankings = await db.select().from(rankings)
        .where(and(eq(rankings.tenantId, tournament.tenantId), eq(rankings.autoInclude, true)))

      // Rankings vinculados manualmente
      const linkedLinks = await db.select().from(rankingTournaments)
        .where(eq(rankingTournaments.tournamentId, id))
      const linkedRankingIds = linkedLinks.map((l) => l.rankingId)
      const linkedRankings = linkedRankingIds.length
        ? await db.select().from(rankings).where(inArray(rankings.id, linkedRankingIds))
        : []

      const allRankingIds = [...new Set([
        ...autoRankings.map((r) => r.id),
        ...linkedRankings.map((r) => r.id),
      ])]

      for (const rankingId of allRankingIds) {
        await removePointsFromRanking(rankingId, id)
      }

      // Remove vínculo manual se existir
      if (linkedRankingIds.length) {
        await db.delete(rankingTournaments).where(eq(rankingTournaments.tournamentId, id))
      }
    }

    const [t] = await db.update(tournaments)
      .set({ status: 'in_progress', pointsAwarded: false, updatedAt: new Date() })
      .where(eq(tournaments.id, id))
      .returning()
    return t
  })

  app.delete('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.delete(tournaments).where(eq(tournaments.id, id))
    return reply.status(204).send()
  })

  // DELETE inscrição
  app.delete('/tournaments/registrations/:registrationId', async (request, reply) => {
    const { registrationId } = request.params as { registrationId: string }
    await db.delete(tournamentRegistrations).where(eq(tournamentRegistrations.id, registrationId))
    return reply.status(204).send()
  })
}
