import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  athletes, draws, matches, matchLiveStates, tournamentCategories, tournamentRegistrations,
} from '../db/schema.js'
import { selectRegistrations } from '../db/registrations.js'
import { roundLabel } from '../domain/schedule.js'
import { computeLiveScore, type Side } from '../domain/live-score.js'
import { LiveBus } from './live-bus.js'

// Leitura do placar ao vivo: monta as visões públicas (só nomes de atletas, nada pessoal) a partir
// de `matches` + `match_live_states`. As escritas (iniciar, ponto, desfazer, encerrar) ficam em
// routes/live.ts e publicam no `liveBus` depois de gravar.

type Reader = Pick<typeof db, 'select'>

export interface LiveSetScore {
  score1: number
  score2: number
}

/** Partida ao vivo como a API pública e o stream SSE a entregam. */
export interface LiveMatchView {
  matchId: string
  tournamentId: string
  categoryId: string
  categoryName: string
  discipline: string
  drawId: string
  round: number
  roundLabel: string
  position: number
  courtNumber: number | null
  scheduledAt: string | null
  status: 'in_progress'
  participant1: string | null
  participant2: string | null
  /** Sets já encerrados. */
  sets: LiveSetScore[]
  /** Set em disputa; `null` quando a partida já tem vencedor e só falta encerrar. */
  currentSet: { setNumber: number; score1: number; score2: number } | null
  setsWon: { side1: number; side2: number }
  /** Quem venceu a partida pelo placar; a partida só vira resultado oficial ao encerrar. */
  winner: Side | null
  /** Sobe a cada escrita: operadores o enviam de volta para detectar edição concorrente. */
  version: number
  /** Momento da última alteração do placar (ISO). */
  updatedAt: string
}

/** Partida pronta para começar (pendente, com os dois lados definidos). */
export interface QueueMatchView {
  matchId: string
  tournamentId: string
  categoryId: string
  categoryName: string
  discipline: string
  drawId: string
  round: number
  roundLabel: string
  position: number
  courtNumber: number | null
  scheduledAt: string | null
  participant1: string
  participant2: string
}

export const liveBus = new LiveBus<LiveMatchView>()

type MatchRow = typeof matches.$inferSelect

interface MatchWithContext {
  match: MatchRow
  tournamentId: string
  categoryId: string
  categoryName: string
  discipline: string
}

async function participantNames(ex: Reader, rows: MatchRow[]): Promise<(registrationId: string | null) => string | null> {
  const regIds = [...new Set(rows.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))]
  const registrations = regIds.length
    ? await selectRegistrations(inArray(tournamentRegistrations.id, regIds), { includeDeleted: true, executor: ex })
    : []
  const athletesByReg = new Map(registrations.map((r) => [r.id, r.athlete2Id ? [r.athleteId, r.athlete2Id] : [r.athleteId]]))
  const athleteIds = [...new Set([...athletesByReg.values()].flat())]
  // Só id e nome: nada de e-mail, CPF, telefone ou nascimento.
  const rows2 = athleteIds.length
    ? await ex.select({ id: athletes.id, name: athletes.name }).from(athletes).where(inArray(athletes.id, athleteIds))
    : []
  const nameById = new Map(rows2.map((a) => [a.id, a.name]))
  return (registrationId) => {
    if (!registrationId) return null
    const ids = athletesByReg.get(registrationId)
    if (!ids) return null
    return ids.map((id) => nameById.get(id) ?? '?').join(' / ')
  }
}

function contextQuery(ex: Reader) {
  return ex.select({
    match: matches,
    tournamentId: tournamentCategories.tournamentId,
    categoryId: tournamentCategories.id,
    categoryName: tournamentCategories.name,
    discipline: tournamentCategories.discipline,
  })
    .from(matches)
    .innerJoin(draws, eq(draws.id, matches.drawId))
    .innerJoin(tournamentCategories, eq(tournamentCategories.id, draws.categoryId))
    .$dynamic()
}

/** Chaves em uso do torneio: uma por categoria (a mais antiga), como a agenda e o encerramento. */
async function activeDrawIds(ex: Reader, tournamentId: string): Promise<string[]> {
  const categories = await ex.select({ id: tournamentCategories.id }).from(tournamentCategories)
    .where(and(eq(tournamentCategories.tournamentId, tournamentId), isNull(tournamentCategories.deletedAt)))
  if (!categories.length) return []
  const drawRows = await ex.select().from(draws)
    .where(inArray(draws.categoryId, categories.map((c) => c.id)))
    .orderBy(asc(draws.generatedAt), asc(draws.id))
  const byCategory = new Map<string, string>()
  for (const draw of drawRows) if (!byCategory.has(draw.categoryId)) byCategory.set(draw.categoryId, draw.id)
  return [...byCategory.values()]
}

async function loadContexts(ex: Reader, tournamentId: string, status: MatchRow['status']): Promise<MatchWithContext[]> {
  const drawIds = await activeDrawIds(ex, tournamentId)
  if (!drawIds.length) return []
  return contextQuery(ex).where(and(inArray(matches.drawId, drawIds), eq(matches.status, status)))
}

export async function toLiveViews(ex: Reader, contexts: MatchWithContext[]): Promise<LiveMatchView[]> {
  if (!contexts.length) return []
  const matchIds = contexts.map((c) => c.match.id)
  const states = await ex.select().from(matchLiveStates).where(inArray(matchLiveStates.matchId, matchIds))
  const stateByMatch = new Map(states.map((s) => [s.matchId, s]))
  const nameOf = await participantNames(ex, contexts.map((c) => c.match))

  return contexts.map(({ match, tournamentId, categoryId, categoryName, discipline }) => {
    const state = stateByMatch.get(match.id)
    const score = computeLiveScore(state?.points ?? [])
    return {
      matchId: match.id,
      tournamentId,
      categoryId,
      categoryName,
      discipline,
      drawId: match.drawId,
      round: match.round,
      roundLabel: roundLabel(match.round),
      position: match.position,
      courtNumber: match.courtNumber,
      scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
      status: 'in_progress' as const,
      participant1: nameOf(match.registration1Id),
      participant2: nameOf(match.registration2Id),
      sets: score.sets,
      currentSet: score.currentSet,
      setsWon: score.setsWon,
      winner: score.winner,
      version: state?.version ?? 0,
      updatedAt: (state?.updatedAt ?? match.updatedAt).toISOString(),
    }
  })
}

function byCourtThenStart(a: { courtNumber: number | null; scheduledAt: string | null; matchId: string }, b: typeof a): number {
  const courtA = a.courtNumber ?? Number.MAX_SAFE_INTEGER
  const courtB = b.courtNumber ?? Number.MAX_SAFE_INTEGER
  if (courtA !== courtB) return courtA - courtB
  const timeA = a.scheduledAt ?? '9999'
  const timeB = b.scheduledAt ?? '9999'
  if (timeA !== timeB) return timeA < timeB ? -1 : 1
  return a.matchId < b.matchId ? -1 : 1
}

/** Partidas em andamento do torneio, por quadra. */
export async function listLiveMatches(ex: Reader, tournamentId: string): Promise<LiveMatchView[]> {
  const views = await toLiveViews(ex, await loadContexts(ex, tournamentId, 'in_progress'))
  return views.sort(byCourtThenStart)
}

/** Visão de uma partida (qualquer status ainda `in_progress`) e o torneio dela. */
export async function getLiveMatchView(ex: Reader, matchId: string): Promise<LiveMatchView | null> {
  const [context] = await contextQuery(ex).where(eq(matches.id, matchId))
  if (!context) return null
  const [view] = await toLiveViews(ex, [context])
  return view ?? null
}

/** Partidas que podem começar: pendentes, com os dois lados definidos, por quadra e horário. */
export async function listQueue(ex: Reader, tournamentId: string): Promise<QueueMatchView[]> {
  const contexts = (await loadContexts(ex, tournamentId, 'pending'))
    .filter(({ match }) => match.registration1Id !== null && match.registration2Id !== null)
  if (!contexts.length) return []
  const nameOf = await participantNames(ex, contexts.map((c) => c.match))
  const queue: QueueMatchView[] = contexts.map(({ match, tournamentId: tid, categoryId, categoryName, discipline }) => ({
    matchId: match.id,
    tournamentId: tid,
    categoryId,
    categoryName,
    discipline,
    drawId: match.drawId,
    round: match.round,
    roundLabel: roundLabel(match.round),
    position: match.position,
    courtNumber: match.courtNumber,
    scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
    participant1: nameOf(match.registration1Id) ?? '?',
    participant2: nameOf(match.registration2Id) ?? '?',
  }))
  return queue.sort(byCourtThenStart)
}
