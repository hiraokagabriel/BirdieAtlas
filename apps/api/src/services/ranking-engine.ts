import { and, eq, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../db/index.js'
import { selectRegistrations } from '../db/registrations.js'
import {
  athletes, draws, matches, matchResults, pointRules, rankingEntries, rankings, rankingTournaments,
  tournamentCategories, tournamentRegistrations, tournaments,
} from '../db/schema.js'
import { isDoublesDiscipline, isGenderCompatible, normalizePair } from '../domain/eligibility.js'
import { computeDrawPlacements } from '../domain/placements.js'
import { findRule, resolvePoints } from '../domain/points.js'
import { sortRankingEntries } from '../domain/ranking-order.js'
import { isDrawFinished } from '../domain/groups.js'

// ---------------------------------------------------------------------------
// Motor único de ranking. Toda pontuação sai de `point_rules`; distribuir pontos de um
// torneio, reabri-lo e recalcular um ranking passam por `recalculateRanking`.
// ---------------------------------------------------------------------------

const FINAL_MATCH_STATUSES = ['completed', 'walkover', 'retired']

function isByeMatch(match: { registration1Id: string | null; registration2Id: string | null }): boolean {
  return match.registration1Id === null || match.registration2Id === null
}

/** Partida ainda sem desfecho: não terminou e não é bye. */
export function isPendingMatch(match: { status: string; registration1Id: string | null; registration2Id: string | null }): boolean {
  return !FINAL_MATCH_STATUSES.includes(match.status) && !isByeMatch(match)
}

// ---------------------------------------------------------------------------
// Acumulador por atleta com histórico por torneio (para countBestResults)
// ---------------------------------------------------------------------------
type TournamentResult = { tournamentId: string; points: number; placement: number }
type AthleteAcc = {
  athleteId: string
  athlete2Id: string | null
  resultsByTournament: Map<string, TournamentResult>
}

// ---------------------------------------------------------------------------
// Recálculo
// ---------------------------------------------------------------------------
export async function recalculateRanking(rankingId: string) {
  const [ranking] = await db.select().from(rankings).where(eq(rankings.id, rankingId))
  if (!ranking) throw new Error('Ranking not found')

  let tournamentLinks: { tournamentId: string; tournamentMultiplier: number; levelOverride: string | null; isScoring: boolean }[] = []

  if (ranking.autoInclude) {
    const allT = await db.select().from(tournaments)
      .where(and(eq(tournaments.tenantId, ranking.tenantId), eq(tournaments.pointsAwarded, true), isNull(tournaments.deletedAt)))
    tournamentLinks = allT.map((t) => ({ tournamentId: t.id, tournamentMultiplier: 1.0, levelOverride: null, isScoring: true }))
  } else {
    const links = await db.select().from(rankingTournaments)
      .where(and(eq(rankingTournaments.rankingId, rankingId), eq(rankingTournaments.isScoring, true)))
    tournamentLinks = links.map((l) => ({
      tournamentId: l.tournamentId,
      tournamentMultiplier: l.tournamentMultiplier,
      levelOverride: l.levelOverride ?? null,
      isScoring: l.isScoring,
    }))
  }

  await db.delete(rankingEntries).where(eq(rankingEntries.rankingId, rankingId))

  if (!tournamentLinks.length) return { recalculated: 0 }

  const rules = await db.select().from(pointRules)
    .where(and(eq(pointRules.rankingId, rankingId), isNull(pointRules.deletedAt)))

  const isDoubles = isDoublesDiscipline(ranking.discipline)
  const acc = new Map<string, AthleteAcc>()

  for (const link of tournamentLinks) {
    const { tournamentId, tournamentMultiplier, levelOverride } = link

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!tournament) continue

    const effectiveLevel = levelOverride ?? tournament.level

    const categories = await db.select().from(tournamentCategories)
      .where(and(
        eq(tournamentCategories.tournamentId, tournamentId),
        eq(tournamentCategories.discipline, ranking.discipline),
      ))

    for (const category of categories) {
      const drawList = await db.select().from(draws).where(eq(draws.categoryId, category.id))
      if (!drawList.length) continue

      const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawList[0]!.id))

      if (allMatches.some(isPendingMatch) || !isDrawFinished(category.drawType, allMatches, drawList[0]!.config)) continue

      const setsByMatchId = new Map<string, { score1: number; score2: number }[]>()
      for (const match of allMatches) {
        if (match.registration1Id === null && match.registration2Id === null) continue
        setsByMatchId.set(match.id, await db.select().from(matchResults).where(eq(matchResults.matchId, match.id)))
      }
      const placementByReg = computeDrawPlacements(category.drawType, allMatches, setsByMatchId)

      const regIds = [...placementByReg.keys()]
      if (!regIds.length) continue

      const regs = await selectRegistrations(inArray(tournamentRegistrations.id, regIds), { includeDeleted: true })
      const allAthleteIds = [...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
      const athleteRows = allAthleteIds.length
        ? await db.select().from(athletes).where(inArray(athletes.id, allAthleteIds))
        : []
      const athleteMap = new Map(athleteRows.map((a) => [a.id, a]))

      for (const [regId, placement] of placementByReg.entries()) {
        const reg = regs.find((r) => r.id === regId)
        if (!reg) continue
        const a1 = athleteMap.get(reg.athleteId)
        const a2 = reg.athlete2Id ? athleteMap.get(reg.athlete2Id) : undefined
        if (!a1) continue
        if (!isGenderCompatible(ranking.discipline, a1.gender, a2?.gender)) continue

        const pts = Math.round(resolvePoints(rules, effectiveLevel, ranking.discipline, placement) * tournamentMultiplier)

        const getOrCreate = (key: string, athleteId: string, athlete2Id: string | null): AthleteAcc => {
          if (!acc.has(key)) acc.set(key, { athleteId, athlete2Id, resultsByTournament: new Map() })
          return acc.get(key)!
        }

        if (isDoubles) {
          if (!reg.athlete2Id) continue
          const [normA1, normA2] = normalizePair(reg.athleteId, reg.athlete2Id)
          const entry = getOrCreate(`${normA1}::${normA2}`, normA1, normA2)
          const prev = entry.resultsByTournament.get(tournamentId)
          if (!prev || pts > prev.points) {
            entry.resultsByTournament.set(tournamentId, { tournamentId, points: pts, placement })
          }
        } else {
          const entry = getOrCreate(reg.athleteId, reg.athleteId, null)
          const prev = entry.resultsByTournament.get(tournamentId)
          if (!prev || pts > prev.points) {
            entry.resultsByTournament.set(tournamentId, { tournamentId, points: pts, placement })
          }
        }
      }
    }
  }

  const final: {
    athleteId: string; athlete2Id: string | null; totalPoints: number; tournamentsCount: number
    resultsDetail: TournamentResult[]; counted: TournamentResult[]
  }[] = []

  for (const entry of acc.values()) {
    const allResults = [...entry.resultsByTournament.values()]
    const tournamentsCount = allResults.length

    if (ranking.minTournamentsRequired > 0 && tournamentsCount < ranking.minTournamentsRequired) continue

    const resultsToCount = ranking.countBestResults
      ? [...allResults].sort((a, b) => b.points - a.points).slice(0, ranking.countBestResults)
      : allResults

    final.push({
      athleteId: entry.athleteId,
      athlete2Id: entry.athlete2Id,
      totalPoints: resultsToCount.reduce((sum, r) => sum + r.points, 0),
      tournamentsCount,
      resultsDetail: [...allResults].sort((a, b) => b.points - a.points),
      counted: resultsToCount,
    })
  }

  // Desempate: ver domain/ranking-order.ts.
  const sorted = sortRankingEntries(final)

  if (sorted.length) {
    await db.insert(rankingEntries).values(
      sorted.map((e, i) => ({
        id: randomUUID(),
        rankingId,
        athleteId: e.athleteId,
        athlete2Id: e.athlete2Id,
        totalPoints: e.totalPoints,
        tournamentsCount: e.tournamentsCount,
        resultsDetail: e.resultsDetail,
        position: i + 1,
      }))
    )
  }

  await db.update(rankings)
    .set({ lastCalculatedAt: new Date(), updatedAt: new Date() })
    .where(eq(rankings.id, rankingId))

  return { recalculated: sorted.length }
}

// ---------------------------------------------------------------------------
// Distribuir e revogar os pontos de um torneio
// ---------------------------------------------------------------------------
type TournamentRow = typeof tournaments.$inferSelect

export interface AwardedEntry {
  rankingId: string
  rankingName: string
  athleteId: string
  athlete2Id: string | null
  placement: number
  points: number
}

export type AwardResult =
  | {
      ok: true
      awarded: AwardedEntry[]
      rankings: { id: string; name: string; recalculated: number }[]
      skipped: { rankingName: string; reason: string }[]
    }
  | {
      ok: false
      code: 'TOURNAMENT_NOT_FINISHED' | 'NO_RANKING' | 'NO_POINT_RULES'
      message: string
      details?: unknown
    }

/**
 * Distribui os pontos de um torneio: vincula o torneio aos rankings ativos do tenant que têm
 * categoria na disciplina e regra para o nível, marca `pointsAwarded` e recalcula esses rankings.
 * Só vale quando todas as categorias têm chave e todas as partidas terminaram.
 */
export async function awardTournamentPoints(tournament: TournamentRow): Promise<AwardResult> {
  const categories = await db.select().from(tournamentCategories)
    .where(and(eq(tournamentCategories.tournamentId, tournament.id), isNull(tournamentCategories.deletedAt)))

  const unfinished: string[] = []
  for (const category of categories) {
    const [draw] = await db.select().from(draws).where(eq(draws.categoryId, category.id))
    if (!draw) { unfinished.push(`${category.name}: chave não gerada`); continue }
    const drawMatches = await db.select().from(matches).where(eq(matches.drawId, draw.id))
    const pending = drawMatches.filter(isPendingMatch).length
    if (!drawMatches.length) unfinished.push(`${category.name}: chave vazia`)
    else if (pending > 0) unfinished.push(`${category.name}: ${pending} partida(s) pendente(s)`)
    else if (!isDrawFinished(category.drawType, drawMatches, draw.config)) {
      unfinished.push(`${category.name}: ${category.drawType === 'swiss' ? 'faltam rodadas do suíço' : category.drawType === 'double_elimination' ? 'a grande final ainda não foi jogada' : 'eliminatória ainda não gerada'}`)
    }
  }
  if (!categories.length || unfinished.length) {
    return {
      ok: false,
      code: 'TOURNAMENT_NOT_FINISHED',
      message: 'Só é possível distribuir pontos quando todas as categorias têm chave e todas as partidas terminaram.',
      details: { unfinished },
    }
  }

  const disciplines = new Set<string>(categories.map((c) => c.discipline))
  const candidates = (await db.select().from(rankings).where(and(
    eq(rankings.tenantId, tournament.tenantId),
    eq(rankings.status, 'active'),
    isNull(rankings.deletedAt),
  ))).filter((r) => disciplines.has(r.discipline))
  if (!candidates.length) {
    return { ok: false, code: 'NO_RANKING', message: 'Nenhum ranking ativo cobre as disciplinas deste torneio.' }
  }

  const applicable: typeof candidates = []
  const skipped: { rankingName: string; reason: string }[] = []
  for (const ranking of candidates) {
    const rules = await db.select().from(pointRules)
      .where(and(eq(pointRules.rankingId, ranking.id), isNull(pointRules.deletedAt)))
    if (findRule(rules, tournament.level, ranking.discipline)) applicable.push(ranking)
    else skipped.push({ rankingName: ranking.name, reason: `Sem regra de pontos para o nível ${tournament.level}.` })
  }
  if (!applicable.length) {
    return {
      ok: false,
      code: 'NO_POINT_RULES',
      message: `Nenhum ranking tem regra de pontos para o nível ${tournament.level}. Configure em Rankings, aba Regras de pontos.`,
      details: { skipped },
    }
  }

  const createdLinkIds: string[] = []
  try {
    await db.update(tournaments).set({ pointsAwarded: true, updatedAt: new Date() }).where(eq(tournaments.id, tournament.id))

    for (const ranking of applicable) {
      const [existing] = await db.select({ id: rankingTournaments.id }).from(rankingTournaments)
        .where(and(eq(rankingTournaments.rankingId, ranking.id), eq(rankingTournaments.tournamentId, tournament.id)))
      if (existing) continue
      const [link] = await db.insert(rankingTournaments)
        .values({ id: randomUUID(), rankingId: ranking.id, tournamentId: tournament.id, isScoring: true })
        .returning({ id: rankingTournaments.id })
      createdLinkIds.push(link!.id)
    }

    const recalculated: { id: string; name: string; recalculated: number }[] = []
    const awarded: AwardedEntry[] = []
    for (const ranking of applicable) {
      const { recalculated: count } = await recalculateRanking(ranking.id)
      recalculated.push({ id: ranking.id, name: ranking.name, recalculated: count })

      const entries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, ranking.id))
      for (const entry of entries) {
        const results = Array.isArray(entry.resultsDetail) ? (entry.resultsDetail as TournamentResult[]) : []
        const result = results.find((r) => r.tournamentId === tournament.id)
        if (result) {
          awarded.push({
            rankingId: ranking.id,
            rankingName: ranking.name,
            athleteId: entry.athleteId,
            athlete2Id: entry.athlete2Id,
            placement: result.placement,
            points: result.points,
          })
        }
      }
    }
    return { ok: true, awarded, rankings: recalculated, skipped }
  } catch (error) {
    // Falhou no meio: devolve o torneio ao estado anterior para poder tentar de novo
    await db.update(tournaments).set({ pointsAwarded: false, updatedAt: new Date() }).where(eq(tournaments.id, tournament.id))
    if (createdLinkIds.length) await db.delete(rankingTournaments).where(inArray(rankingTournaments.id, createdLinkIds))
    throw error
  }
}

/**
 * Tira os pontos de um torneio dos rankings: desfaz os vínculos e recalcula todo ranking que o contava
 * (por vínculo ou por `autoInclude`). Chame depois de `pointsAwarded` já ter voltado a `false`.
 */
export async function revokeTournamentPoints(tournament: TournamentRow): Promise<number> {
  const links = await db.select({ rankingId: rankingTournaments.rankingId }).from(rankingTournaments)
    .where(eq(rankingTournaments.tournamentId, tournament.id))
  const autoRankings = await db.select({ id: rankings.id }).from(rankings).where(and(
    eq(rankings.tenantId, tournament.tenantId),
    eq(rankings.autoInclude, true),
    isNull(rankings.deletedAt),
  ))
  const affected = [...new Set([...links.map((l) => l.rankingId), ...autoRankings.map((r) => r.id)])]

  if (links.length) await db.delete(rankingTournaments).where(eq(rankingTournaments.tournamentId, tournament.id))
  for (const rankingId of affected) await recalculateRanking(rankingId)
  return affected.length
}
