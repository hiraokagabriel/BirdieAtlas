import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import {
  tournaments, tournamentCategories, tournamentRegistrations,
  draws, matches, matchResults, athletes,
} from '../db/schema.js'
import { eq, ne, and, inArray, isNull, asc, desc, count } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import {
  TOURNAMENT_TRANSITIONS,
  canTransitionTournament,
  tournamentLevelSchema,
  dedicatedTransitionEndpoint,
  paginationQuerySchema,
  tournamentTransitionBodySchema,
} from '@birdie-atlas/validators'
import { selectRegistrations } from '../db/registrations.js'
import { paginate } from '../domain/pagination.js'
import { revokeTournamentPoints } from '../services/ranking-engine.js'
import { getDefaultTenantId } from '../tenant.js'

const listTournamentsQuerySchema = paginationQuerySchema.extend({
  public: z.enum(['true', 'false']).optional(),
})

const createTournamentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  level: tournamentLevelSchema.default('state'),
  city: z.string().optional(),
  state: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  registrationDeadline: z.string().optional(),
})

const createCategorySchema = z.object({
  name: z.string().min(1),
  discipline: z.enum(['MS', 'WS', 'MD', 'WD', 'XD']),
  maxEntries: z.number().int().optional(),
})

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  if (!sets.length) return null
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}

function resolveWinnerLoser(
  match: { registration1Id: string | null; registration2Id: string | null; status: string },
  sets: { score1: number; score2: number }[],
): { winnerRegId: string; loserRegId: string | null } | null {
  const { registration1Id, registration2Id, status } = match
  if (registration2Id === null && registration1Id !== null) return { winnerRegId: registration1Id, loserRegId: null }
  if (registration1Id === null && registration2Id !== null) return { winnerRegId: registration2Id, loserRegId: null }
  if (!registration1Id || !registration2Id) return null
  if (status === 'walkover' || status === 'retired') {
    if (!sets.length) return null
    const winnerSlot = getWinnerSlot(sets)
    if (!winnerSlot) return null
    return {
      winnerRegId: winnerSlot === 1 ? registration1Id : registration2Id,
      loserRegId:  winnerSlot === 1 ? registration2Id : registration1Id,
    }
  }
  return null
}

export async function tournamentsRoutes(app: FastifyInstance) {
  // Lista paginada do tenant padrão. `public=true` esconde rascunhos (portal público).
  app.get('/tournaments', async (request) => {
    const query = listTournamentsQuerySchema.parse(request.query)
    const tenantId = await getDefaultTenantId()
    const where = and(
      eq(tournaments.tenantId, tenantId),
      isNull(tournaments.deletedAt),
      query.public === 'true' ? ne(tournaments.status, 'draft') : undefined,
    )
    return paginate(
      query,
      (limit, offset) =>
        db.select().from(tournaments).where(where)
          .orderBy(desc(tournaments.startDate), asc(tournaments.id))
          .limit(limit).offset(offset),
      async () => (await db.select({ total: count() }).from(tournaments).where(where))[0]?.total ?? 0,
    )
  })

  // Deve vir ANTES de /tournaments/:id para nao colidir com o parametro dinamico
  app.get('/tournaments/by-slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const [t] = await db.select().from(tournaments).where(and(eq(tournaments.slug, slug), isNull(tournaments.deletedAt)))
    if (!t) return reply.status(404).send({ error: 'Tournament not found' })
    return t
  })

  /**
   * Retorna dados agregados para a pagina publica do torneio.
   * Uma unica chamada substitui: GET /tournaments/:id + GET /tournaments/:id/categories
   * + N chamadas de registrations + N chamadas de draws/matches.
   */
  app.get('/tournaments/:id/public-summary', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })

    const cats = await db.select().from(tournamentCategories)
      .where(and(eq(tournamentCategories.tournamentId, id), isNull(tournamentCategories.deletedAt)))

    let totalAthletes = 0
    let totalMatches = 0
    let completedMatches = 0

    const categorySummaries = await Promise.all(cats.map(async (cat) => {
      // Recusadas não competem: não entram nas contagens públicas
      const regs = await selectRegistrations(
        and(eq(tournamentRegistrations.categoryId, cat.id), ne(tournamentRegistrations.status, 'rejected')),
      )

      const athleteIds = new Set<string>()
      regs.forEach((r) => {
        athleteIds.add(r.athleteId)
        if (r.athlete2Id) athleteIds.add(r.athlete2Id)
      })

      const drawList = await db.select().from(draws).where(eq(draws.categoryId, cat.id))
      let catMatches = 0
      let catCompleted = 0
      if (drawList.length) {
        const matchList = await db.select().from(matches).where(eq(matches.drawId, drawList[0].id))
        catMatches = matchList.length
        catCompleted = matchList.filter((m) =>
          ['completed', 'walkover', 'retired'].includes(m.status)
        ).length
      }

      totalAthletes += athleteIds.size
      totalMatches += catMatches
      completedMatches += catCompleted

      return {
        id: cat.id,
        name: cat.name,
        discipline: cat.discipline,
        drawType: cat.drawType,
        registrationCount: regs.length,
        athleteCount: athleteIds.size,
        matchCount: catMatches,
        completedMatchCount: catCompleted,
        hasPublishedDraw: drawList.length > 0 && drawList[0].published,
      }
    }))

    return {
      tournament,
      categories: categorySummaries,
      stats: {
        totalCategories: cats.length,
        totalAthletes,
        totalMatches,
        completedMatches,
      },
    }
  })

  app.get('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [t] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
    if (!t) return reply.status(404).send({ error: 'Tournament not found' })
    return t
  })

  app.get('/tournaments/:id/categories', async (request) => {
    const { id } = request.params as { id: string }
    return db.select().from(tournamentCategories).where(and(eq(tournamentCategories.tournamentId, id), isNull(tournamentCategories.deletedAt)))
  })

  app.post('/tournaments', async (request, reply) => {
    const body = createTournamentSchema.parse(request.body)
    const tenantId = await getDefaultTenantId()
    const [t] = await db.insert(tournaments).values({ id: randomUUID(), status: 'draft', tenantId, ...body }).returning()
    return reply.status(201).send(t)
  })

  app.post('/tournaments/:id/categories', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createCategorySchema.parse(request.body)
    const [cat] = await db.insert(tournamentCategories).values({ id: randomUUID(), tournamentId: id, ...body }).returning()
    return reply.status(201).send(cat)
  })

  app.put('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createTournamentSchema.partial().parse(request.body)
    const [t] = await db.update(tournaments).set({ ...body, updatedAt: new Date() }).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt))).returning()
    if (!t) return reply.status(404).send({ error: 'Tournament not found' })
    return t
  })

  // Transições simples do ciclo de vida. Encerrar e reabrir têm endpoints próprios (finalize/reopen).
  app.post('/tournaments/:id/transition', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { to } = tournamentTransitionBodySchema.parse(request.body)
    const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })

    if (!canTransitionTournament(tournament.status, to)) {
      return reply.status(409).send({
        error: `Transição inválida: ${tournament.status} → ${to}.`,
        code: 'INVALID_TOURNAMENT_TRANSITION',
        details: { from: tournament.status, to, allowed: TOURNAMENT_TRANSITIONS[tournament.status] },
      })
    }
    const dedicated = dedicatedTransitionEndpoint(tournament.status, to)
    if (dedicated) {
      return reply.status(409).send({
        error: `Use POST /tournaments/${id}/${dedicated} para esta transição.`,
        code: 'USE_DEDICATED_ENDPOINT',
        details: { endpoint: dedicated },
      })
    }

    // Compare-and-set: só atualiza se o status ainda for o lido acima
    const [updated] = await db.update(tournaments)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(tournaments.id, id), eq(tournaments.status, tournament.status)))
      .returning()
    if (!updated) {
      return reply.status(409).send({ error: 'O status do torneio mudou durante a operação. Recarregue e tente novamente.', code: 'TOURNAMENT_STATUS_CHANGED' })
    }
    return updated
  })

  app.post('/tournaments/:id/finalize', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    if (!canTransitionTournament(tournament.status, 'completed')) {
      return reply.status(409).send({
        error: `Só torneios em andamento podem ser encerrados (status atual: ${tournament.status}).`,
        code: 'INVALID_TOURNAMENT_TRANSITION',
      })
    }
    const categories = await db.select().from(tournamentCategories).where(and(eq(tournamentCategories.tournamentId, id), isNull(tournamentCategories.deletedAt)))
    if (!categories.length) return reply.status(400).send({ error: 'No categories found' })
    const incomplete: string[] = []
    for (const cat of categories) {
      const drawList = await db.select().from(draws).where(eq(draws.categoryId, cat.id))
      if (!drawList.length) { incomplete.push(`${cat.name}: chave nao gerada`); continue }
      const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawList[0].id))
      const pending = allMatches.filter((m) => !['completed', 'walkover', 'retired'].includes(m.status))
      if (pending.length > 0) incomplete.push(`${cat.name}: ${pending.length} partida(s) pendente(s)`)
    }
    if (incomplete.length > 0) {
      return reply.status(400).send({ error: 'Nao e possivel encerrar: existem chaves incompletas.', incomplete })
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
        if (match.registration1Id === null && match.registration2Id === null) continue
        const sets = await db.select().from(matchResults).where(eq(matchResults.matchId, match.id))
        let winnerRegId: string | null = null
        let loserRegId: string | null = null
        if (sets.length > 0 && match.status === 'completed') {
          const winner = getWinnerSlot(sets)
          if (!winner) continue
          winnerRegId = winner === 1 ? match.registration1Id : match.registration2Id
          loserRegId  = winner === 1 ? match.registration2Id : match.registration1Id
        } else {
          const result = resolveWinnerLoser(match, sets)
          if (!result) continue
          winnerRegId = result.winnerRegId
          loserRegId  = result.loserRegId
        }
        const loserPlacement = match.round === 1 ? 2 : Math.pow(2, match.round - 1) + 1
        if (loserRegId) placementByReg.set(loserRegId, loserPlacement)
        if (match.round === 1 && winnerRegId) placementByReg.set(winnerRegId, 1)
      }
      const top4 = [...placementByReg.entries()].sort((a, b) => a[1] - b[1]).slice(0, 4)
      if (!top4.length) continue
      const regIds = top4.map(([regId]) => regId)
      const regs = await selectRegistrations(inArray(tournamentRegistrations.id, regIds), { includeDeleted: true })
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

  app.post('/tournaments/:id/reopen', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    if (tournament.status !== 'completed') {
      return reply.status(409).send({ error: 'Only completed tournaments can be reopened', code: 'INVALID_TOURNAMENT_TRANSITION' })
    }
    // O status e `pointsAwarded` voltam primeiro: rankings `autoInclude` só contam torneios com pontos distribuídos.
    const [t] = await db.update(tournaments)
      .set({ status: 'in_progress', pointsAwarded: false, updatedAt: new Date() })
      .where(eq(tournaments.id, id))
      .returning()
    // Os rankings que contavam o torneio são recalculados pelo motor único, com as regras de pontos de cada um.
    if (tournament.pointsAwarded) await revokeTournamentPoints(tournament)
    return t
  })

  app.delete('/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.update(tournaments).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
    return reply.status(204).send()
  })
}
