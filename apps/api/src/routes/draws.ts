import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { draws, matches, matchLiveStates, matchResults, tournamentCategories, tournamentRegistrations, tournaments } from '../db/schema.js'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { buildMatchDefs, buildSlots, type MatchDef } from '../domain/bracket.js'
import { buildRoundRobinMatchDefs, computeRoundRobinStandings } from '../domain/round-robin.js'
import { awardTournamentPoints } from '../services/ranking-engine.js'
import { selectRegistrations } from '../db/registrations.js'
import { saveMatchResult } from '../services/match-result.js'
import { getLiveMatchView, liveBus } from '../services/live-match.js'

const upsertMatchResultSchema = z.object({
  sets: z.array(z.object({ setNumber: z.number(), score1: z.number(), score2: z.number() })),
  status: z.enum(['completed', 'walkover', 'retired']),
})

const scheduleMatchSchema = z.object({
  scheduledAt: z.string().nullable(),
  courtNumber: z.number().nullable(),
})

/** Monta as partidas conforme o formato da categoria (eliminação simples ou todos contra todos). */
async function buildCategoryMatchDefs(
  drawId: string,
  categoryId: string,
  confirmed: { id: string; seed: number | null }[],
  mode: 'random' | 'seeded',
): Promise<MatchDef[]> {
  const [category] = await db.select({ drawType: tournamentCategories.drawType }).from(tournamentCategories).where(eq(tournamentCategories.id, categoryId))
  if (category?.drawType === 'round_robin') {
    // Ordem de saída do círculo: sorteada; com cabeças de chave, elas ficam nas primeiras posições (por ordem).
    const ordered = mode === 'seeded'
      ? [...confirmed].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER))
      : [...confirmed].sort(() => Math.random() - 0.5)
    return buildRoundRobinMatchDefs(drawId, ordered.map((r) => r.id))
  }
  return buildMatchDefs(drawId, buildSlots(confirmed, mode))
}

const generateDrawSchema = z.object({
  mode: z.enum(['random', 'seeded']).default('seeded'),
})

export async function drawsRoutes(app: FastifyInstance) {
  app.get('/tournaments/categories/:categoryId/draws', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    return db.select().from(draws).where(eq(draws.categoryId, categoryId))
  })

  app.post('/draws/generate/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const { mode } = generateDrawSchema.parse(request.body ?? {})

    const confirmed = await selectRegistrations(and(eq(tournamentRegistrations.categoryId, categoryId), eq(tournamentRegistrations.status, 'approved')))
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 approved registrations' })

    const [draw]     = await db.insert(draws).values({ id: randomUUID(), categoryId, drawMode: mode }).returning()
    const matchDefs  = await buildCategoryMatchDefs(draw.id, categoryId, confirmed, mode)

    await db.insert(matches).values(matchDefs)
    return reply.status(201).send({ draw, matchCount: matchDefs.length, mode })
  })

  app.post('/draws/:drawId/redraw', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const { mode }   = generateDrawSchema.parse(request.body ?? {})

    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })

    // Block redraw when draw is published
    if (draw.published) {
      return reply.status(409).send({
        error: 'Cannot redraw a published draw. Unpublish it first.',
        code: 'DRAW_PUBLISHED',
      })
    }

    // Valida antes de apagar: uma refação que falha não pode destruir a chave atual.
    const confirmed = await selectRegistrations(and(eq(tournamentRegistrations.categoryId, draw.categoryId), eq(tournamentRegistrations.status, 'approved')))
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 approved registrations' })

    const matchDefs = await buildCategoryMatchDefs(drawId, draw.categoryId, confirmed, mode)

    // Apagar a chave antiga e gravar a nova é uma operação só: ou troca inteira, ou nada.
    let liveMatchIds: string[] = []
    const updated = await db.transaction(async (tx) => {
      const existingMatches = await tx.select({ id: matches.id, status: matches.status }).from(matches).where(eq(matches.drawId, drawId))
      const matchIds = existingMatches.map((m) => m.id)
      liveMatchIds = existingMatches.filter((m) => m.status === 'in_progress').map((m) => m.id)
      if (matchIds.length) {
        await tx.delete(matchLiveStates).where(inArray(matchLiveStates.matchId, matchIds))
        await tx.delete(matchResults).where(inArray(matchResults.matchId, matchIds))
      }
      await tx.delete(matches).where(eq(matches.drawId, drawId))
      await tx.insert(matches).values(matchDefs)

      const [row] = await tx.update(draws)
        .set({ drawMode: mode, published: false, generatedAt: new Date(), updatedAt: new Date() })
        .where(eq(draws.id, drawId))
        .returning()
      return row
    })

    if (liveMatchIds.length) {
      const [owner] = await db.select({ tournamentId: tournamentCategories.tournamentId })
        .from(tournamentCategories).where(eq(tournamentCategories.id, draw.categoryId))
      if (owner) for (const id of liveMatchIds) liveBus.publish(owner.tournamentId, { type: 'match-ended', matchId: id, reason: 'cancelled' })
    }

    return reply.status(200).send({ draw: updated, matchCount: matchDefs.length, mode })
  })

  app.post('/draws/:drawId/migrate-next-match-id', async (request) => {
    const { drawId } = request.params as { drawId: string }
    const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawId))
    // Só vale para chaves de eliminação simples: outros formatos (round_label gravado) não encadeiam partidas.
    if (allMatches.some((m) => m.roundLabel !== null)) return { updated: 0, total: allMatches.length }
    let updated = 0
    for (const match of allMatches) {
      if (match.round === 1) continue
      const next = allMatches.find((m) => m.round === match.round - 1 && m.position === Math.ceil(match.position / 2))
      if (next && match.nextMatchId !== next.id) {
        await db.update(matches).set({ nextMatchId: next.id }).where(eq(matches.id, match.id))
        updated++
      }
    }
    return { updated, total: allMatches.length }
  })

  // Classificação do todos contra todos (público). Em outros formatos devolve lista vazia.
  app.get('/draws/:drawId/standings', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found', code: 'DRAW_NOT_FOUND' })
    const [category] = await db.select({ drawType: tournamentCategories.drawType }).from(tournamentCategories).where(eq(tournamentCategories.id, draw.categoryId))
    if (category?.drawType !== 'round_robin') return { rows: [] }

    const drawMatches = await db.select().from(matches).where(eq(matches.drawId, drawId))
    const setRows = drawMatches.length
      ? await db.select().from(matchResults).where(inArray(matchResults.matchId, drawMatches.map((m) => m.id)))
      : []
    const setsByMatchId = new Map<string, { score1: number; score2: number }[]>()
    for (const s of setRows) setsByMatchId.set(s.matchId, [...(setsByMatchId.get(s.matchId) ?? []), s])
    const regIds = [...new Set(drawMatches.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))]
    const rows = computeRoundRobinStandings(regIds, drawMatches, setsByMatchId).map((row, i) => ({ position: i + 1, ...row }))
    return { rows }
  })

  app.get('/draws/:drawId/matches', async (request) => {
    const { drawId } = request.params as { drawId: string }
    return db.select().from(matches).where(eq(matches.drawId, drawId))
  })

  app.post('/draws/:drawId/publish', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: true, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  app.post('/draws/:drawId/unpublish', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: false, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  // Distribui os pontos do torneio pelas regras de pontos dos rankings (ver services/ranking-engine.ts)
  app.post('/tournaments/:tournamentId/award-points', async (request, reply) => {
    const { tournamentId } = request.params as { tournamentId: string }

    const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, tournamentId), isNull(tournaments.deletedAt)))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    if (tournament.pointsAwarded) {
      return reply.status(409).send({ error: 'Os pontos deste torneio já foram distribuídos.', code: 'POINTS_ALREADY_AWARDED' })
    }

    const result = await awardTournamentPoints(tournament)
    if (!result.ok) {
      const status = result.code === 'TOURNAMENT_NOT_FINISHED' ? 409 : 422
      return reply.status(status).send({ error: result.message, code: result.code, details: result.details })
    }
    return { awarded: result.awarded, rankings: result.rankings, skipped: result.skipped }
  })
  app.patch('/draws/matches/:matchId/schedule', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = scheduleMatchSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })
    const [updated] = await db.update(matches)
      .set({ scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, courtNumber: body.courtNumber, updatedAt: new Date() })
      .where(eq(matches.id, matchId)).returning()
    // Quadra mudou com a partida ao vivo: o painel público acompanha.
    if (updated && updated.status === 'in_progress') {
      const view = await getLiveMatchView(db, matchId)
      if (view) liveBus.publish(view.tournamentId, { type: 'match', match: view })
    }
    return updated
  })

  // A lógica vive em services/match-result.ts: a mesma função encerra partidas ao vivo (routes/live.ts).
  app.post('/draws/matches/:matchId/result', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = upsertMatchResultSchema.parse(request.body)

    const saved = await db.transaction((tx) => saveMatchResult(tx, matchId, body))
    if (!saved.ok) return reply.status(saved.status).send({ error: saved.error, ...(saved.code ? { code: saved.code } : {}) })

    // Quem acompanha o torneio ao vivo atualiza a chave (e some o placar provisório, se havia).
    if (saved.tournamentId) {
      liveBus.publish(saved.tournamentId, { type: 'match-ended', matchId, reason: 'finished' })
      for (const resetId of saved.resetMatchIds) liveBus.publish(saved.tournamentId, { type: 'match-ended', matchId: resetId, reason: 'cancelled' })
    }
    return { match: saved.match, results: saved.results }
  })

  app.get('/draws/matches/:matchId/result', async (request) => {
    const { matchId } = request.params as { matchId: string }
    return db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  })
}
