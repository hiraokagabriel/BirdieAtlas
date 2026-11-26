import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { draws, matches, matchLiveStates, matchResultEvents, matchResults, tournamentCategories, tournamentRegistrations, tournaments } from '../db/schema.js'
import { eq, and, asc, desc, inArray, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { buildMatchDefs, buildSlots, type MatchDef } from '../domain/bracket.js'
import { buildRoundRobinMatchDefs, computeRoundRobinStandings } from '../domain/round-robin.js'
import { buildDoubleEliminationDefs, planDoubleElimination } from '../domain/double-elimination.js'
import {
  buildSwissRoundDefs, computeSwissStandings, pairFirstRound, pairKey, pairSwissRound, planSwiss, swissProgress,
} from '../domain/swiss.js'
import {
  buildGroupMatchDefs, buildKnockoutMatchDefs, computeGroupStandings, distributeToGroups, pickQualifiers, planGroups, type GroupConfig,
} from '../domain/groups.js'
import { awardTournamentPoints } from '../services/ranking-engine.js'
import { selectRegistrations } from '../db/registrations.js'
import { publicRegistrations } from './registrations.js'
import { compareCategoriesForPublication } from '../domain/bracket-order.js'
import { findOwnerTournament, isTournamentLocked, saveMatchResult, TOURNAMENT_LOCKED_MESSAGE } from '../services/match-result.js'
import { getLiveMatchView, liveBus } from '../services/live-match.js'

const upsertMatchResultSchema = z.object({
  sets: z.array(z.object({ setNumber: z.number(), score1: z.number(), score2: z.number() })),
  status: z.enum(['completed', 'walkover', 'retired']),
})

const scheduleMatchSchema = z.object({
  scheduledAt: z.string().nullable(),
  courtNumber: z.number().nullable(),
})

type BuiltDraw =
  | { ok: true; defs: MatchDef[]; config: GroupConfig | { rounds: number } | { reset: boolean } | null }
  | { ok: false; status?: 404; error: string; code: 'INVALID_GROUP_CONFIG' | 'INVALID_SWISS_CONFIG' | 'INVALID_DOUBLE_ELIMINATION_CONFIG' | 'CATEGORY_NOT_FOUND' }

type DrawTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Monta as partidas conforme o formato da categoria (eliminação simples, todos contra todos ou fase de grupos). */
async function buildCategoryMatchDefs(
  tx: DrawTx,
  drawId: string,
  categoryId: string,
  confirmed: { id: string; seed: number | null }[],
  requested: {
    mode: 'random' | 'seeded'
    groupCount?: number | undefined
    groupSize?: number | undefined
    advancePerGroup?: number | undefined
    swissRounds?: number | undefined
    doubleEliminationReset?: boolean | undefined
  },
): Promise<BuiltDraw> {
  // Trava a categoria: formato e padrão do sorteio não mudam (PATCH) nem ela some (DELETE) enquanto a chave é montada.
  const [category] = await tx.select({ drawType: tournamentCategories.drawType, drawConfig: tournamentCategories.drawConfig })
    .from(tournamentCategories)
    .where(and(eq(tournamentCategories.id, categoryId), isNull(tournamentCategories.deletedAt)))
    .for('update')
  if (!category) return { ok: false, status: 404, error: 'Categoria não encontrada.', code: 'CATEGORY_NOT_FOUND' }
  // O que o sorteio não informa vem da configuração da categoria; `groupSize` no corpo substitui o número de grupos padrão.
  const defaults = category?.drawConfig ?? {}
  const options = {
    ...requested,
    groupCount: requested.groupCount ?? (requested.groupSize === undefined ? defaults.groupCount : undefined),
    advancePerGroup: requested.advancePerGroup ?? defaults.advancePerGroup,
    swissRounds: requested.swissRounds ?? defaults.swissRounds,
    doubleEliminationReset: requested.doubleEliminationReset ?? defaults.doubleEliminationReset,
  }
  const { mode } = options
  if (category?.drawType === 'group_then_elimination') {
    const planned = planGroups({ entries: confirmed.length, groupCount: options.groupCount, groupSize: options.groupSize, advancePerGroup: options.advancePerGroup })
    if (!planned.ok) return { ok: false, error: planned.error, code: 'INVALID_GROUP_CONFIG' }
    const groups = distributeToGroups(confirmed, planned.plan.sizes, mode)
    return {
      ok: true,
      defs: buildGroupMatchDefs(drawId, groups, planned.plan.knockoutRounds),
      config: { groupCount: planned.plan.groupCount, advancePerGroup: planned.plan.advancePerGroup },
    }
  }
  if (category?.drawType === 'double_elimination') {
    const planned = planDoubleElimination(confirmed.length)
    if (!planned.ok) return { ok: false, error: planned.error, code: 'INVALID_DOUBLE_ELIMINATION_CONFIG' }
    const reset = options.doubleEliminationReset ?? true
    return { ok: true, defs: buildDoubleEliminationDefs(drawId, confirmed, mode, reset), config: { reset } }
  }
  if (category?.drawType === 'swiss') {
    const planned = planSwiss({ entries: confirmed.length, rounds: options.swissRounds })
    if (!planned.ok) return { ok: false, error: planned.error, code: 'INVALID_SWISS_CONFIG' }
    // Só a rodada 1 existe; as seguintes saem de POST /draws/:drawId/swiss/next-round.
    return { ok: true, defs: buildSwissRoundDefs(drawId, planned.rounds, 1, pairFirstRound(confirmed, mode)), config: { rounds: planned.rounds } }
  }
  if (category?.drawType === 'round_robin') {
    // Ordem de saída do círculo: sorteada; com cabeças de chave, elas ficam nas primeiras posições (por ordem).
    const ordered = mode === 'seeded'
      ? [...confirmed].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER))
      : [...confirmed].sort(() => Math.random() - 0.5)
    return { ok: true, defs: buildRoundRobinMatchDefs(drawId, ordered.map((r) => r.id)), config: null }
  }
  return { ok: true, defs: buildMatchDefs(drawId, buildSlots(confirmed, mode)), config: null }
}

const generateDrawSchema = z.object({
  mode: z.enum(['random', 'seeded']).default('seeded'),
  // Grupos + eliminatória (ignorados nos outros formatos): número de grupos OU pessoas por grupo, e classificados por grupo.
  groupCount: z.number().int().optional(),
  groupSize: z.number().int().optional(),
  advancePerGroup: z.number().int().optional(),
  // Suíço (ignorado nos outros formatos): número de rodadas (padrão ⌈log₂ inscritos⌉).
  swissRounds: z.number().int().optional(),
  // Eliminação dupla: se a grande final tem reset (padrão: sim).
  doubleEliminationReset: z.boolean().optional(),
})

const drawIdParams = z.object({ drawId: z.string().trim().min(1) })
const categoryIdParams = z.object({ categoryId: z.string().trim().min(1) })
const matchIdParams = z.object({ matchId: z.string().trim().min(1) })
const tournamentIdParams = z.object({ tournamentId: z.string().trim().min(1) })

export async function drawsRoutes(app: FastifyInstance) {
  app.get('/tournaments/categories/:categoryId/draws', async (request) => {
    const { categoryId } = categoryIdParams.parse(request.params)
    return db.select().from(draws).where(eq(draws.categoryId, categoryId))
  })

  app.post('/draws/generate/:categoryId', async (request, reply) => {
    const { categoryId } = categoryIdParams.parse(request.params)
    const body = generateDrawSchema.parse(request.body ?? {})
    const { mode } = body

    const confirmed = await selectRegistrations(and(eq(tournamentRegistrations.categoryId, categoryId), eq(tournamentRegistrations.status, 'approved')))
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 approved registrations' })

    const drawId = randomUUID()
    const outcome = await db.transaction(async (tx) => {
      const built = await buildCategoryMatchDefs(tx, drawId, categoryId, confirmed, body)
      if (!built.ok) return built
      const [row] = await tx.insert(draws).values({ id: drawId, categoryId, drawMode: mode, config: built.config }).returning()
      await tx.insert(matches).values(built.defs)
      return { ok: true as const, draw: row, matchCount: built.defs.length }
    })
    if (!outcome.ok) return reply.status(outcome.status ?? 422).send({ error: outcome.error, code: outcome.code })
    return reply.status(201).send({ draw: outcome.draw, matchCount: outcome.matchCount, mode })
  })

  app.post('/draws/:drawId/redraw', async (request, reply) => {
    const { drawId } = drawIdParams.parse(request.params)
    const body       = generateDrawSchema.parse(request.body ?? {})
    const { mode }   = body

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

    // Apagar a chave antiga e gravar a nova é uma operação só: ou troca inteira, ou nada.
    // A chave nova é montada (e validada) antes de apagar a atual, com a categoria travada.
    let liveMatchIds: string[] = []
    const outcome = await db.transaction(async (tx) => {
      const built = await buildCategoryMatchDefs(tx, drawId, draw.categoryId, confirmed, body)
      if (!built.ok) return built
      const matchDefs = built.defs
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
        .set({ drawMode: mode, config: built.config, published: false, generatedAt: new Date(), updatedAt: new Date() })
        .where(eq(draws.id, drawId))
        .returning()
      return { ok: true as const, row, matchCount: matchDefs.length }
    })
    if (!outcome.ok) return reply.status(outcome.status ?? 422).send({ error: outcome.error, code: outcome.code })
    const updated = outcome.row

    if (liveMatchIds.length) {
      const [owner] = await db.select({ tournamentId: tournamentCategories.tournamentId })
        .from(tournamentCategories).where(eq(tournamentCategories.id, draw.categoryId))
      if (owner) for (const id of liveMatchIds) liveBus.publish(owner.tournamentId, { type: 'match-ended', matchId: id, reason: 'cancelled' })
    }

    return reply.status(200).send({ draw: updated, matchCount: outcome.matchCount, mode })
  })

  app.post('/draws/:drawId/migrate-next-match-id', async (request) => {
    const { drawId } = drawIdParams.parse(request.params)
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

  // Classificação do todos contra todos e dos grupos (público). Eliminação simples: lista vazia.
  app.get('/draws/:drawId/standings', async (request, reply) => {
    const { drawId } = drawIdParams.parse(request.params)
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found', code: 'DRAW_NOT_FOUND' })
    const [category] = await db.select({ drawType: tournamentCategories.drawType }).from(tournamentCategories).where(eq(tournamentCategories.id, draw.categoryId))
    if (category?.drawType !== 'round_robin' && category?.drawType !== 'group_then_elimination' && category?.drawType !== 'swiss') {
      return { rows: [], groups: [] }
    }

    const drawMatches = await db.select().from(matches).where(eq(matches.drawId, drawId))
    const setRows = drawMatches.length
      ? await db.select().from(matchResults).where(inArray(matchResults.matchId, drawMatches.map((m) => m.id)))
      : []
    const setsByMatchId = new Map<string, { score1: number; score2: number }[]>()
    for (const s of setRows) setsByMatchId.set(s.matchId, [...(setsByMatchId.get(s.matchId) ?? []), s])

    if (category.drawType === 'group_then_elimination') {
      return { rows: [], groups: computeGroupStandings(drawMatches, setsByMatchId) }
    }
    const regIds = [...new Set(drawMatches.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))]
    if (category.drawType === 'swiss') {
      const swissRows = computeSwissStandings(regIds, drawMatches, setsByMatchId).map((row, i) => ({ position: i + 1, ...row }))
      const total = (draw.config as { rounds?: number } | null)?.rounds ?? 0
      return { rows: swissRows, groups: [], rounds: swissProgress(drawMatches, total) }
    }
    const rows = computeRoundRobinStandings(regIds, drawMatches, setsByMatchId).map((row, i) => ({ position: i + 1, ...row }))
    return { rows, groups: [] }
  })

  // Grupos + eliminatória: cria a eliminatória com os classificados, quando os grupos terminam.
  app.post('/draws/:drawId/knockout', async (request, reply) => {
    const { drawId } = drawIdParams.parse(request.params)
    // Uma transação com a chave travada (FOR UPDATE): dois cliques ou um retry não geram a fase duas vezes.
    const result = await db.transaction(async (tx) => {
        const [draw] = await tx.select().from(draws).where(eq(draws.id, drawId)).for('update')
    if (!draw) return { status: 404, body: { error: 'Draw not found', code: 'DRAW_NOT_FOUND' } }
    const owner = await findOwnerTournament(tx, draw.id)
    if (owner && isTournamentLocked(owner.status)) {
      return { status: 409, body: { error: TOURNAMENT_LOCKED_MESSAGE, code: 'TOURNAMENT_LOCKED' } }
    }
    const [category] = await tx.select().from(tournamentCategories).where(eq(tournamentCategories.id, draw.categoryId))
    if (category?.drawType !== 'group_then_elimination') {
      return { status: 409, body: { error: 'Esta categoria não tem fase de grupos.', code: 'NOT_GROUP_FORMAT' } }
    }
    const config = draw.config as GroupConfig | null
    if (!config) return { status: 409, body: { error: 'A chave não tem configuração de grupos. Sorteie de novo.', code: 'MISSING_GROUP_CONFIG' } }

    const drawMatches = await tx.select().from(matches).where(eq(matches.drawId, drawId))
    if (drawMatches.some((m) => m.stage === 'knockout')) {
      return { status: 409, body: { error: 'A eliminatória já foi gerada.', code: 'KNOCKOUT_ALREADY_GENERATED' } }
    }
    const pending = drawMatches.filter((m) => !['completed', 'walkover', 'retired'].includes(m.status) && m.registration1Id && m.registration2Id)
    if (pending.length > 0) {
      return { status: 409, body: {
        error: `Ainda há ${pending.length} partida(s) da fase de grupos sem resultado.`,
        code: 'GROUPS_NOT_FINISHED',
        details: { pending: pending.length },
      } }
    }

    const setRows = await tx.select().from(matchResults).where(inArray(matchResults.matchId, drawMatches.map((m) => m.id)))
    const setsByMatchId = new Map<string, { score1: number; score2: number }[]>()
    for (const s of setRows) setsByMatchId.set(s.matchId, [...(setsByMatchId.get(s.matchId) ?? []), s])

    const qualifiers = pickQualifiers(computeGroupStandings(drawMatches, setsByMatchId), config.advancePerGroup)
    if (qualifiers.length < 2) return { status: 409, body: { error: 'Classificados insuficientes para a eliminatória.', code: 'NOT_ENOUGH_QUALIFIERS' } }

    const defs = buildKnockoutMatchDefs(drawId, qualifiers)
    await tx.insert(matches).values(defs)
    return { status: 201, body: { matchCount: defs.length, qualifiers: qualifiers.length } }
    })
    return reply.status(result.status).send(result.body)
  })

  // Suíço: gera a próxima rodada, pareando por classificação sem repetir adversário, quando a atual termina.
  app.post('/draws/:drawId/swiss/next-round', async (request, reply) => {
    const { drawId } = drawIdParams.parse(request.params)
    // Uma transação com a chave travada (FOR UPDATE): dois cliques ou um retry não geram a fase duas vezes.
    const result = await db.transaction(async (tx) => {
        const [draw] = await tx.select().from(draws).where(eq(draws.id, drawId)).for('update')
    if (!draw) return { status: 404, body: { error: 'Draw not found', code: 'DRAW_NOT_FOUND' } }
    const owner = await findOwnerTournament(tx, draw.id)
    if (owner && isTournamentLocked(owner.status)) {
      return { status: 409, body: { error: TOURNAMENT_LOCKED_MESSAGE, code: 'TOURNAMENT_LOCKED' } }
    }
    const [category] = await db.select({ drawType: tournamentCategories.drawType }).from(tournamentCategories).where(eq(tournamentCategories.id, draw.categoryId))
    if (category?.drawType !== 'swiss') return { status: 409, body: { error: 'Esta categoria não é suíço.', code: 'NOT_SWISS_FORMAT' } }
    const total = (draw.config as { rounds?: number } | null)?.rounds
    if (!total) return { status: 409, body: { error: 'A chave não tem número de rodadas. Sorteie de novo.', code: 'MISSING_SWISS_CONFIG' } }

    const drawMatches = await tx.select().from(matches).where(eq(matches.drawId, drawId))
    const progress = swissProgress(drawMatches, total)
    if (progress.generated >= total) {
      return { status: 409, body: { error: 'Todas as rodadas já foram geradas.', code: 'SWISS_ROUNDS_COMPLETE' } }
    }
    const pending = drawMatches.filter((m) => !['completed', 'walkover', 'retired'].includes(m.status) && m.registration1Id && m.registration2Id)
    if (pending.length > 0) {
      return { status: 409, body: {
        error: `Ainda há ${pending.length} partida(s) da rodada ${progress.generated} sem resultado.`,
        code: 'ROUND_NOT_FINISHED',
        details: { pending: pending.length },
      } }
    }

    const setRows = await tx.select().from(matchResults).where(inArray(matchResults.matchId, drawMatches.map((m) => m.id)))
    const setsByMatchId = new Map<string, { score1: number; score2: number }[]>()
    for (const s of setRows) setsByMatchId.set(s.matchId, [...(setsByMatchId.get(s.matchId) ?? []), s])

    const regIds = [...new Set(drawMatches.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))]
    const ranked = computeSwissStandings(regIds, drawMatches, setsByMatchId).map((r) => r.registrationId)
    const played = new Set(drawMatches.filter((m) => m.registration1Id && m.registration2Id).map((m) => pairKey(m.registration1Id!, m.registration2Id!)))
    const byeHistory = new Set(drawMatches.filter((m) => (m.registration1Id === null) !== (m.registration2Id === null)).map((m) => (m.registration1Id ?? m.registration2Id)!))

    const pairing = pairSwissRound(ranked, played, byeHistory)
    const defs = buildSwissRoundDefs(drawId, total, progress.generated + 1, pairing)
    await tx.insert(matches).values(defs)
    return { status: 201, body: {
      round: progress.generated + 1,
      matchCount: defs.length,
      bye: pairing.bye,
      rematches: pairing.rematches,
    } }
    })
    return reply.status(result.status).send(result.body)
  })

  app.get('/draws/:drawId/matches', async (request) => {
    const { drawId } = drawIdParams.parse(request.params)
    return db.select().from(matches).where(eq(matches.drawId, drawId))
  })

  app.post('/draws/:drawId/publish', async (request, reply) => {
    const { drawId } = drawIdParams.parse(request.params)
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: true, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  app.post('/draws/:drawId/unpublish', async (request, reply) => {
    const { drawId } = drawIdParams.parse(request.params)
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: false, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  // Distribui os pontos do torneio pelas regras de pontos dos rankings (ver services/ranking-engine.ts)
  app.post('/tournaments/:tournamentId/award-points', async (request, reply) => {
    const { tournamentId } = tournamentIdParams.parse(request.params)

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
    const { matchId } = matchIdParams.parse(request.params)
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
    const { matchId } = matchIdParams.parse(request.params)
    const body = upsertMatchResultSchema.parse(request.body)

    const saved = await db.transaction((tx) => saveMatchResult(tx, matchId, body, 'dialog'))
    if (!saved.ok) return reply.status(saved.status).send({ error: saved.error, ...(saved.code ? { code: saved.code } : {}) })

    // Quem acompanha o torneio ao vivo atualiza a chave (e some o placar provisório, se havia).
    if (saved.tournamentId) {
      liveBus.publish(saved.tournamentId, { type: 'match-ended', matchId, reason: 'finished' })
      for (const resetId of saved.resetMatchIds) liveBus.publish(saved.tournamentId, { type: 'match-ended', matchId: resetId, reason: 'cancelled' })
    }
    return { match: saved.match, results: saved.results }
  })

  // Histórico de gravações do resultado (admin, ADMIN_ONLY_READS), da mais recente para a mais antiga.
  app.get('/draws/matches/:matchId/result-history', async (request, reply) => {
    const { matchId } = matchIdParams.parse(request.params)
    const [match] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found', code: 'MATCH_NOT_FOUND' })
    const rows = await db.select().from(matchResultEvents).where(eq(matchResultEvents.matchId, matchId))
      .orderBy(desc(matchResultEvents.createdAt), desc(matchResultEvents.id))
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  })

  // Público: todas as chaves publicadas do torneio de uma vez (página de divulgação / PDF).
  // Só nomes de atletas (publicRegistrations); chaves não publicadas e categorias sem chave ficam de fora.
  app.get('/tournaments/:id/brackets', async (request, reply) => {
    const { id } = z.object({ id: z.string().trim().min(1) }).parse(request.params)
    const [tournament] = await db.select({ id: tournaments.id }).from(tournaments)
      .where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt), ne(tournaments.status, 'draft')))
    if (!tournament) return reply.status(404).send({ error: 'Torneio não encontrado.', code: 'TOURNAMENT_NOT_FOUND' })
    const categories = await db.select().from(tournamentCategories)
      .where(and(eq(tournamentCategories.tournamentId, id), isNull(tournamentCategories.deletedAt)))
    if (!categories.length) return []
    const drawRows = await db.select().from(draws)
      .where(and(inArray(draws.categoryId, categories.map((c) => c.id)), eq(draws.published, true)))
      .orderBy(asc(draws.generatedAt))
    // Uma chave por categoria (a mais antiga), como a agenda e o encerramento.
    const drawByCategory = new Map<string, typeof drawRows[number]>()
    for (const d of drawRows) if (!drawByCategory.has(d.categoryId)) drawByCategory.set(d.categoryId, d)
    const published = categories.filter((c) => drawByCategory.has(c.id)).sort(compareCategoriesForPublication)
    if (!published.length) return []
    const drawIds = published.map((c) => drawByCategory.get(c.id)!.id)
    // Um parâmetro por chave (não por partida): torneio grande tem milhares de partidas.
    const matchRows = await db.select().from(matches).where(inArray(matches.drawId, drawIds))
    const resultRows = await db.select({ result: matchResults, drawId: matches.drawId }).from(matchResults)
      .innerJoin(matches, eq(matches.id, matchResults.matchId))
      .where(inArray(matches.drawId, drawIds))
    const regs = await publicRegistrations(published.map((c) => c.id))
    const group = <T, K>(rows: T[], key: (row: T) => K) => {
      const map = new Map<K, T[]>()
      for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row])
      return map
    }
    const matchesByDraw = group(matchRows, (m) => m.drawId)
    const resultsByDraw = group(resultRows, (r) => r.drawId)
    const regsByCategory = group(regs, (r) => r.categoryId)
    return published.map((c) => {
      const draw = drawByCategory.get(c.id)!
      return {
        category: { id: c.id, name: c.name, discipline: c.discipline, drawType: c.drawType },
        draw: { id: draw.id, config: draw.config },
        matches: matchesByDraw.get(draw.id) ?? [],
        registrations: regsByCategory.get(c.id) ?? [],
        results: (resultsByDraw.get(draw.id) ?? []).map((r) => r.result),
      }
    })
  })

  app.get('/draws/matches/:matchId/result', async (request) => {
    const { matchId } = matchIdParams.parse(request.params)
    return db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  })
}
