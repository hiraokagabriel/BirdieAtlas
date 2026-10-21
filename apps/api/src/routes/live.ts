import type { FastifyInstance } from 'fastify'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { db } from '../db/index.js'
import { draws, matches, matchLiveStates, tournamentCategories, tournaments } from '../db/schema.js'
import { canAddPoint, computeLiveScore, toResultSets, type Side } from '../domain/live-score.js'
import { formatSseComment, formatSseMessage, SSE_HEADERS } from '../domain/sse.js'
import {
  getLiveMatchView, listLiveMatches, listQueue, liveBus, type LiveMatchView,
} from '../services/live-match.js'
import type { LiveEvent } from '../services/live-bus.js'
import {
  findOwnerTournament, isTournamentLocked, saveMatchResult, TOURNAMENT_LOCKED_MESSAGE, type Executor,
} from '../services/match-result.js'

// Placar ao vivo. Escritas (POST) exigem modo admin pelo guard global; leituras e o stream SSE são
// públicos e só devolvem nomes de atletas.
//
// Concorrência: cada escrita roda numa transação que trava a linha da partida (`FOR UPDATE`), então
// operadores simultâneos na mesma partida se serializam. Ponto, desfazer e encerrar ainda exigem
// `version`, a versão do placar que o operador viu: se outro operador mexeu antes, a escrita é
// recusada com 409 LIVE_VERSION_CONFLICT e a resposta traz o placar atual.

const HEARTBEAT_MS = 15_000
const MAX_BUFFERED_BYTES = 1_000_000

const matchParamsSchema = z.object({ matchId: z.string().min(1) })
const tournamentParamsSchema = z.object({ id: z.string().min(1) })

const startBodySchema = z.object({
  courtNumber: z.number().int().min(1).max(99).nullable().optional(),
})
const versionBodySchema = z.object({ version: z.number().int().min(0) })
const pointBodySchema = z.object({
  side: z.union([z.literal(1), z.literal(2)]),
  version: z.number().int().min(0),
})

interface Failure {
  ok: false
  status: 404 | 409 | 422
  error: string
  code: string
  details?: unknown
}
type Outcome<T> = { ok: true; value: T } | Failure

const fail = (status: Failure['status'], error: string, code: string, details?: unknown): Failure => ({ ok: false, status, error, code, details })

interface LockedMatch {
  match: typeof matches.$inferSelect
  tournamentId: string
}

/** Trava a partida e confere que o torneio existe e aceita alterações. */
async function lockMatch(tx: Executor, matchId: string): Promise<Outcome<LockedMatch>> {
  const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).for('update')
  if (!match) return fail(404, 'Partida não encontrada.', 'MATCH_NOT_FOUND')
  const owner = await findOwnerTournament(tx, match.drawId)
  if (!owner) return fail(404, 'Torneio não encontrado.', 'TOURNAMENT_NOT_FOUND')
  if (isTournamentLocked(owner.status)) return fail(409, TOURNAMENT_LOCKED_MESSAGE, 'TOURNAMENT_LOCKED')
  return { ok: true, value: { match, tournamentId: owner.id } }
}

async function currentView(tx: Executor, matchId: string): Promise<LiveMatchView> {
  const view = await getLiveMatchView(tx, matchId)
  if (!view) throw new Error(`Partida ${matchId} sem visão ao vivo.`)
  return view
}

/** Placar provisório da partida (travado); cria o registro quando a partida está ao vivo sem ele. */
async function lockLiveState(tx: Executor, matchId: string) {
  await tx.insert(matchLiveStates).values({ id: randomUUID(), matchId }).onConflictDoNothing({ target: matchLiveStates.matchId })
  const [state] = await tx.select().from(matchLiveStates).where(eq(matchLiveStates.matchId, matchId)).for('update')
  if (!state) throw new Error(`Placar da partida ${matchId} não pôde ser criado.`)
  return state
}

/** Carrega a partida ao vivo com placar travado e confere status e versão. */
async function lockLiveMatch(tx: Executor, matchId: string, version: number) {
  const locked = await lockMatch(tx, matchId)
  if (!locked.ok) return locked
  if (locked.value.match.status !== 'in_progress') {
    return fail(409, 'A partida não está em andamento.', 'MATCH_NOT_LIVE', { status: locked.value.match.status })
  }
  const state = await lockLiveState(tx, matchId)
  if (state.version !== version) {
    return fail(409, 'O placar mudou em outro dispositivo. Confira o placar atual e tente de novo.', 'LIVE_VERSION_CONFLICT', {
      expected: version,
      current: await currentView(tx, matchId),
    })
  }
  return { ok: true as const, value: { ...locked.value, state } }
}

export async function liveRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // Leituras públicas
  // -------------------------------------------------------------------------
  async function tournamentExists(id: string): Promise<boolean> {
    const [t] = await db.select({ id: tournaments.id }).from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
    return !!t
  }

  app.get('/tournaments/:id/live/matches', async (request, reply) => {
    const { id } = tournamentParamsSchema.parse(request.params)
    if (!(await tournamentExists(id))) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    return listLiveMatches(db, id)
  })

  app.get('/tournaments/:id/live/queue', async (request, reply) => {
    const { id } = tournamentParamsSchema.parse(request.params)
    if (!(await tournamentExists(id))) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    return listQueue(db, id)
  })

  // -------------------------------------------------------------------------
  // Stream SSE: snapshot ao conectar e atualizações depois.
  //   event: snapshot     data: { matches: LiveMatchView[] }
  //   event: match        data: { match: LiveMatchView }          (início, ponto, desfazer, quadra)
  //   event: match-ended  data: { matchId, reason: 'finished' | 'cancelled' }
  //   comentário ": heartbeat" a cada 15 s
  // -------------------------------------------------------------------------
  const openStreams = new Set<() => void>()
  app.addHook('onClose', async () => {
    for (const close of [...openStreams]) close()
  })

  app.get('/tournaments/:id/live', async (request, reply) => {
    const { id } = tournamentParamsSchema.parse(request.params)
    if (!(await tournamentExists(id))) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })

    // A resposta passa a ser escrita à mão: o Fastify não monta mais cabeçalhos nem serializa.
    // Os que o @fastify/cors já pôs em `reply` (Access-Control-Allow-Origin, Vary) são copiados.
    const headers: Record<string, string | number | string[] | undefined> = { ...reply.getHeaders(), ...SSE_HEADERS }
    const origin = request.headers.origin
    if (origin && headers['access-control-allow-origin'] === undefined) {
      headers['access-control-allow-origin'] = origin
      headers['vary'] = 'Origin'
    }
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, headers)
    raw.socket?.setTimeout(0)
    raw.socket?.setNoDelay(true)

    let closed = false
    let seq = 0
    const timers: { heartbeat?: NodeJS.Timeout; unsubscribe?: () => void } = {}

    const cleanup = () => {
      if (closed) return
      closed = true
      if (timers.heartbeat) clearInterval(timers.heartbeat)
      timers.unsubscribe?.()
      openStreams.delete(cleanup)
      if (!raw.writableEnded) raw.end()
    }
    const write = (frame: string) => {
      if (closed) return
      // Cliente lento demais: encerra em vez de acumular memória; ele reconecta e recebe novo snapshot.
      if (raw.writableLength > MAX_BUFFERED_BYTES) return cleanup()
      raw.write(frame)
    }
    const send = (event: string, data: unknown) => write(formatSseMessage({ event, id: ++seq, data }))
    const sendLive = (event: LiveEvent<LiveMatchView>) => {
      if (event.type === 'match') send('match', { match: event.match })
      else send('match-ended', { matchId: event.matchId, reason: event.reason })
    }

    request.raw.on('close', cleanup)
    raw.on('error', cleanup)
    openStreams.add(cleanup)

    // Assina antes de ler o snapshot e segura os eventos até enviá-lo: nenhuma atualização se perde.
    let ready = false
    const buffered: LiveEvent<LiveMatchView>[] = []
    timers.unsubscribe = liveBus.subscribe(id, (event) => {
      if (ready) sendLive(event)
      else buffered.push(event)
    })

    write(formatSseMessage({ retry: 3000, data: { tournamentId: id }, event: 'ready' }))
    try {
      const matchesNow = await listLiveMatches(db, id)
      send('snapshot', { matches: matchesNow })
    } catch (error) {
      request.log.error(error)
      return cleanup()
    }
    ready = true
    for (const event of buffered) sendLive(event)
    buffered.length = 0

    timers.heartbeat = setInterval(() => write(formatSseComment('heartbeat')), HEARTBEAT_MS)
  })

  // -------------------------------------------------------------------------
  // Escritas (modo admin)
  // -------------------------------------------------------------------------
  function sendFailure(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, f: Failure) {
    return reply.status(f.status).send({ error: f.error, code: f.code, details: f.details })
  }

  // Inicia a partida: pending → in_progress. Exige os dois lados definidos; quadra opcional.
  app.post('/draws/matches/:matchId/live/start', async (request, reply) => {
    const { matchId } = matchParamsSchema.parse(request.params)
    const body = startBodySchema.parse(request.body ?? {})

    const outcome = await db.transaction(async (tx): Promise<Outcome<{ view: LiveMatchView; tournamentId: string }>> => {
      const locked = await lockMatch(tx, matchId)
      if (!locked.ok) return locked
      const { match, tournamentId } = locked.value

      // Trava o torneio: duas partidas começando na mesma quadra ao mesmo tempo se serializam.
      await tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).for('update')

      if (match.status !== 'pending') {
        return fail(409, 'Só uma partida pendente pode ser iniciada.', 'MATCH_NOT_STARTABLE', { status: match.status })
      }
      if (!match.registration1Id || !match.registration2Id) {
        return fail(422, 'A partida ainda não tem os dois participantes definidos.', 'MATCH_NOT_READY')
      }

      const court = body.courtNumber !== undefined ? body.courtNumber : match.courtNumber
      if (court !== null) {
        const [busy] = await tx.select({ id: matches.id })
          .from(matches)
          .innerJoin(draws, eq(draws.id, matches.drawId))
          .innerJoin(tournamentCategories, eq(tournamentCategories.id, draws.categoryId))
          .where(and(
            eq(tournamentCategories.tournamentId, tournamentId),
            eq(matches.status, 'in_progress'),
            eq(matches.courtNumber, court),
            ne(matches.id, matchId),
          ))
          .limit(1)
        if (busy) return fail(409, `A quadra ${court} já tem uma partida em andamento.`, 'COURT_BUSY', { courtNumber: court, matchId: busy.id })
      }

      await tx.delete(matchLiveStates).where(eq(matchLiveStates.matchId, matchId))
      await tx.insert(matchLiveStates).values({ id: randomUUID(), matchId })
      await tx.update(matches)
        .set({ status: 'in_progress', courtNumber: court, updatedAt: new Date() })
        .where(eq(matches.id, matchId))
      return { ok: true, value: { view: await currentView(tx, matchId), tournamentId } }
    })

    if (!outcome.ok) return sendFailure(reply, outcome)
    liveBus.publish(outcome.value.tournamentId, { type: 'match', match: outcome.value.view })
    return outcome.value.view
  })

  // Ponto para um lado. `version` é a versão do placar que o operador viu.
  app.post('/draws/matches/:matchId/live/point', async (request, reply) => {
    const { matchId } = matchParamsSchema.parse(request.params)
    const body = pointBodySchema.parse(request.body)

    const outcome = await db.transaction(async (tx): Promise<Outcome<{ view: LiveMatchView; tournamentId: string }>> => {
      const live = await lockLiveMatch(tx, matchId, body.version)
      if (!live.ok) return live
      const points: Side[] = live.value.state.points
      if (!canAddPoint(points)) {
        return fail(409, 'A partida já tem vencedor. Desfaça o último ponto ou encerre a partida.', 'LIVE_MATCH_DECIDED')
      }
      await tx.update(matchLiveStates)
        .set({ points: [...points, body.side], version: live.value.state.version + 1, updatedAt: new Date() })
        .where(eq(matchLiveStates.matchId, matchId))
      return { ok: true, value: { view: await currentView(tx, matchId), tournamentId: live.value.tournamentId } }
    })

    if (!outcome.ok) return sendFailure(reply, outcome)
    liveBus.publish(outcome.value.tournamentId, { type: 'match', match: outcome.value.view })
    return outcome.value.view
  })

  // Desfaz o último ponto.
  app.post('/draws/matches/:matchId/live/undo', async (request, reply) => {
    const { matchId } = matchParamsSchema.parse(request.params)
    const body = versionBodySchema.parse(request.body)

    const outcome = await db.transaction(async (tx): Promise<Outcome<{ view: LiveMatchView; tournamentId: string }>> => {
      const live = await lockLiveMatch(tx, matchId, body.version)
      if (!live.ok) return live
      const points: Side[] = live.value.state.points
      if (points.length === 0) return fail(409, 'Não há ponto para desfazer.', 'NOTHING_TO_UNDO')
      await tx.update(matchLiveStates)
        .set({ points: points.slice(0, -1), version: live.value.state.version + 1, updatedAt: new Date() })
        .where(eq(matchLiveStates.matchId, matchId))
      return { ok: true, value: { view: await currentView(tx, matchId), tournamentId: live.value.tournamentId } }
    })

    if (!outcome.ok) return sendFailure(reply, outcome)
    liveBus.publish(outcome.value.tournamentId, { type: 'match', match: outcome.value.view })
    return outcome.value.view
  })

  // Encerra a partida: o placar provisório vira resultado oficial pela mesma função da rota de resultado
  // (vencedor avança, cascata, validações). O provisório é apagado na mesma transação.
  app.post('/draws/matches/:matchId/live/finish', async (request, reply) => {
    const { matchId } = matchParamsSchema.parse(request.params)
    const body = versionBodySchema.parse(request.body)

    const outcome = await db.transaction(async (tx) => {
      const live = await lockLiveMatch(tx, matchId, body.version)
      if (!live.ok) return live
      const score = computeLiveScore(live.value.state.points)
      if (!score.winner) {
        return fail(409, 'A partida ainda não tem vencedor: termine os sets antes de encerrar.', 'LIVE_MATCH_NOT_DECIDED')
      }
      const saved = await saveMatchResult(tx, matchId, { sets: toResultSets(score), status: 'completed' })
      if (!saved.ok) return fail(saved.status === 400 ? 422 : saved.status, saved.error, saved.code ?? 'RESULT_REJECTED')
      return { ok: true as const, value: { saved, tournamentId: live.value.tournamentId } }
    })

    if (!outcome.ok) return sendFailure(reply, outcome)
    const { saved, tournamentId } = outcome.value
    liveBus.publish(tournamentId, { type: 'match-ended', matchId, reason: 'finished' })
    for (const resetId of saved.resetMatchIds) liveBus.publish(tournamentId, { type: 'match-ended', matchId: resetId, reason: 'cancelled' })
    return { match: saved.match, results: saved.results }
  })

  // Desiste do início: descarta o placar provisório e devolve a partida a `pending`.
  app.post('/draws/matches/:matchId/live/cancel', async (request, reply) => {
    const { matchId } = matchParamsSchema.parse(request.params)

    const outcome = await db.transaction(async (tx): Promise<Outcome<{ tournamentId: string }>> => {
      const locked = await lockMatch(tx, matchId)
      if (!locked.ok) return locked
      if (locked.value.match.status !== 'in_progress') {
        return fail(409, 'A partida não está em andamento.', 'MATCH_NOT_LIVE', { status: locked.value.match.status })
      }
      await tx.delete(matchLiveStates).where(eq(matchLiveStates.matchId, matchId))
      await tx.update(matches).set({ status: 'pending', updatedAt: new Date() }).where(eq(matches.id, matchId))
      return { ok: true, value: { tournamentId: locked.value.tournamentId } }
    })

    if (!outcome.ok) return sendFailure(reply, outcome)
    liveBus.publish(outcome.value.tournamentId, { type: 'match-ended', matchId, reason: 'cancelled' })
    return { matchId, status: 'pending' as const }
  })
}
