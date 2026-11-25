import type { FastifyInstance } from 'fastify'
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { draws, matchResults, matches, pairs, tournamentCategories, tournamentRegistrations, tournaments } from '../db/schema.js'
import { getDefaultTenantId } from '../tenant.js'
import { selectRegistrations } from '../db/registrations.js'
import { normalizeSearchText, SEARCH_MIN_LENGTH } from '../domain/athlete-search.js'
import { getPagination } from '../domain/pagination.js'
import { buildPlayerSchedule, nextPlayerMatch } from '../domain/player-schedule.js'
import { paginationQuerySchema } from '@birdie-atlas/validators'
import { getLiveMatchView } from '../services/live-match.js'
import { athleteNames } from './registrations.js'

// "Encontre sua próxima partida" (público): busca de jogador dentro de um torneio e as partidas dele. Só nomes,
// nunca dado pessoal. Ver ESPECIFICACAO_COMPLETA.md, rota /t/[slug]/jogador/[athleteId].

const tournamentParams = z.object({ id: z.string().min(1) })
const playerParams = z.object({ id: z.string().min(1), athleteId: z.string().min(1) })
const searchQuery = paginationQuerySchema.extend({
  q: z.string().trim().min(SEARCH_MIN_LENGTH).max(80),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

/** Inscrições aprovadas do torneio (as que estão na chave), com o nome de cada lado. */
async function loadTournamentPlayers(tournamentId: string) {
  const categories = await db.select({ id: tournamentCategories.id, name: tournamentCategories.name })
    .from(tournamentCategories)
    .where(and(eq(tournamentCategories.tournamentId, tournamentId), isNull(tournamentCategories.deletedAt)))
  if (!categories.length) return { categories, registrations: [], names: new Map<string, string>() }
  const registrations = await selectRegistrations(and(
    inArray(tournamentRegistrations.categoryId, categories.map((c) => c.id)),
    eq(tournamentRegistrations.status, 'approved'),
  ))
  const names = await athleteNames([...new Set(registrations.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))])
  return { categories, registrations, names }
}

async function loadTournament(id: string) {
  const [tournament] = await db.select({ id: tournaments.id, name: tournaments.name, slug: tournaments.slug })
    .from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
  return tournament
}

/** Partidas do jogador no torneio (chaves publicadas, com placar ao vivo); `null` se ele não está inscrito (aprovado). */
async function loadPlayerSchedule(tournamentId: string, athleteId: string) {
  const { categories, registrations, names } = await loadTournamentPlayers(tournamentId)
  const regIds = new Set(registrations.filter((r) => r.athleteId === athleteId || r.athlete2Id === athleteId).map((r) => r.id))
  if (!regIds.size) return null

  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const drawRows = await db.select({ id: draws.id, categoryId: draws.categoryId }).from(draws)
    // Só chaves publicadas: o sorteio provisório não sai no público (como na página do torneio e nas exportações).
    .where(and(inArray(draws.categoryId, categories.map((c) => c.id)), eq(draws.published, true)))
  const drawCategory = new Map(drawRows.map((d) => [d.id, categoryName.get(d.categoryId) ?? '']))
  const drawCategoryId = new Map(drawRows.map((d) => [d.id, d.categoryId]))
  const matchRows = drawRows.length ? await db.select().from(matches).where(inArray(matches.drawId, drawRows.map((d) => d.id))) : []
  const results = matchRows.length ? await db.select().from(matchResults).where(inArray(matchResults.matchId, matchRows.map((m) => m.id))) : []

  const regName = new Map(registrations.map((r) => [
    r.id,
    [r.athleteId, r.athlete2Id].filter(Boolean).map((a) => names.get(a!) ?? '?').join(' / '),
  ]))
  const setsByMatch = new Map<string, { setNumber: number; score1: number; score2: number }[]>()
  for (const s of results) setsByMatch.set(s.matchId, [...(setsByMatch.get(s.matchId) ?? []), s])
  // Ao vivo: os pontos ainda não são match_results; o placar vem do estado ao vivo (sets fechados + set em disputa).
  const myLive = matchRows.filter((m) => m.status === 'in_progress' && [m.registration1Id, m.registration2Id].some((r) => r && regIds.has(r)))
  for (const m of myLive) {
    const view = await getLiveMatchView(db, m.id)
    if (!view) continue
    const sets = view.sets.map((x, i) => ({ setNumber: i + 1, ...x }))
    if (view.currentSet) sets.push(view.currentSet)
    setsByMatch.set(m.id, sets)
  }

  const schedule = buildPlayerSchedule(
    matchRows.map((m) => ({
      id: m.id,
      categoryId: drawCategoryId.get(m.drawId) ?? '',
      categoryName: drawCategory.get(m.drawId) ?? '',
      round: m.round,
      position: m.position,
      roundLabel: m.roundLabel,
      status: m.status,
      registration1Id: m.registration1Id,
      registration2Id: m.registration2Id,
      nextMatchId: m.nextMatchId,
      loserNextMatchId: m.loserNextMatchId,
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
      courtNumber: m.courtNumber,
    })),
    regIds,
    (regId) => regName.get(regId) ?? null,
    (matchId) => [...(setsByMatch.get(matchId) ?? [])].sort((a, b) => a.setNumber - b.setNumber),
  )
  return { name: names.get(athleteId) ?? '', matches: schedule, nextMatchId: nextPlayerMatch(schedule) }
}

export async function playersRoutes(app: FastifyInstance) {
  app.get('/tournaments/:id/players', async (request, reply) => {
    const { id } = tournamentParams.parse(request.params)
    const query = searchQuery.parse(request.query)
    if (!(await loadTournament(id))) return reply.status(404).send({ error: 'Torneio não encontrado.', code: 'TOURNAMENT_NOT_FOUND' })

    const { categories, registrations, names } = await loadTournamentPlayers(id)
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    const needle = normalizeSearchText(query.q)
    const found = new Map<string, { athleteId: string; name: string; categories: string[] }>()
    for (const r of registrations) {
      for (const athleteId of [r.athleteId, r.athlete2Id]) {
        const name = athleteId ? names.get(athleteId) : undefined
        if (!athleteId || !name || !normalizeSearchText(name).includes(needle)) continue
        const entry = found.get(athleteId) ?? { athleteId, name, categories: [] }
        const category = categoryName.get(r.categoryId)
        if (category && !entry.categories.includes(category)) entry.categories.push(category)
        found.set(athleteId, entry)
      }
    }
    const all = [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const start = (query.page - 1) * query.pageSize
    return { data: all.slice(start, start + query.pageSize), pagination: getPagination(query, all.length) }
  })

  app.get('/tournaments/:id/players/:athleteId/matches', async (request, reply) => {
    const { id, athleteId } = playerParams.parse(request.params)
    const tournament = await loadTournament(id)
    if (!tournament) return reply.status(404).send({ error: 'Torneio não encontrado.', code: 'TOURNAMENT_NOT_FOUND' })
    const player = await loadPlayerSchedule(id, athleteId)
    if (!player) return reply.status(404).send({ error: 'Jogador não está inscrito neste torneio.', code: 'PLAYER_NOT_FOUND' })
    return { tournament, athlete: { id: athleteId, name: player.name }, matches: player.matches, nextMatchId: player.nextMatchId }
  })

  // Perfil público do atleta: as partidas a jogar (a próxima primeiro) em cada torneio em andamento (ou com inscrição encerrada) em que ele joga.
  app.get('/athletes/:athleteId/upcoming-matches', async (request) => {
    const { athleteId } = z.object({ athleteId: z.string().min(1) }).parse(request.params)
    // Só torneios do tenant com inscrição aprovada do atleta (simples ou dupla), com inscrição encerrada ou em andamento.
    const active = await db.selectDistinct({ id: tournaments.id, name: tournaments.name, slug: tournaments.slug, startDate: tournaments.startDate })
      .from(tournaments)
      .innerJoin(tournamentCategories, and(eq(tournamentCategories.tournamentId, tournaments.id), isNull(tournamentCategories.deletedAt)))
      .innerJoin(tournamentRegistrations, and(eq(tournamentRegistrations.categoryId, tournamentCategories.id), isNull(tournamentRegistrations.deletedAt), eq(tournamentRegistrations.status, 'approved')))
      .leftJoin(pairs, eq(pairs.id, tournamentRegistrations.pairId))
      .where(and(
        isNull(tournaments.deletedAt),
        eq(tournaments.tenantId, await getDefaultTenantId()),
        inArray(tournaments.status, ['registration_closed', 'in_progress']),
        or(eq(tournamentRegistrations.athleteId, athleteId), eq(pairs.athlete1Id, athleteId), eq(pairs.athlete2Id, athleteId)),
      ))
      .orderBy(asc(tournaments.startDate))
    const data = []
    for (const t of active) {
      const player = await loadPlayerSchedule(t.id, athleteId)
      if (!player?.nextMatchId) continue
      // A em destaque primeiro, depois as demais ainda a jogar (na ordem de jogo), com o "se vencer" de cada uma.
      const pending = player.matches.filter((m) => m.kind === 'upcoming' || m.kind === 'live')
      const next = pending.find((m) => m.matchId === player.nextMatchId)!
      data.push({ tournament: { id: t.id, name: t.name, slug: t.slug }, matches: [next, ...pending.filter((m) => m !== next)] })
    }
    return { data, pagination: getPagination({ page: 1, pageSize: Math.max(data.length, 1) }, data.length) }
  })
}
