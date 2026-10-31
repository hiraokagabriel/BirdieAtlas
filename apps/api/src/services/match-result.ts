import { randomUUID } from 'crypto'
import { and, eq, isNull, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  draws, matches, matchLiveStates, matchResults, tournamentCategories, tournaments,
} from '../db/schema.js'
import { getSlotForPosition } from '../domain/bracket.js'

// Resultado oficial de uma partida: grava os sets, faz o vencedor avançar e desfaz em cascata o que
// dependia de um vencedor anterior. É a única implementação: a rota de resultado e o encerramento
// de uma partida ao vivo passam por `saveMatchResult`. Placar provisório (match_live_states) nunca
// é lido aqui nem pelos cálculos de colocação e pontos.

/** `db` ou uma transação. */
export type Executor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>

export interface ResultSetInput {
  setNumber: number
  score1: number
  score2: number
}

export interface ResultInput {
  sets: ResultSetInput[]
  status: 'completed' | 'walkover' | 'retired'
}

export function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}

type MatchRow = typeof matches.$inferSelect

export interface OwnerTournament {
  id: string
  status: typeof tournaments.$inferSelect.status
}

/** Torneio dono da partida (ignora torneio excluído). */
export async function findOwnerTournament(ex: Pick<typeof db, 'select'>, drawId: string): Promise<OwnerTournament | undefined> {
  const [owner] = await ex.select({ id: tournaments.id, status: tournaments.status })
    .from(draws)
    .innerJoin(tournamentCategories, eq(tournamentCategories.id, draws.categoryId))
    .innerJoin(tournaments, eq(tournaments.id, tournamentCategories.tournamentId))
    .where(and(eq(draws.id, drawId), isNull(tournaments.deletedAt)))
  return owner
}

export const TOURNAMENT_LOCKED_MESSAGE = 'O torneio está encerrado. Reabra-o para alterar resultados.'

export function isTournamentLocked(status: OwnerTournament['status']): boolean {
  return status === 'completed' || status === 'cancelled'
}

export type SaveResultOutcome =
  | { ok: true; match: MatchRow; results: (typeof matchResults.$inferSelect)[]; tournamentId: string | null; resetMatchIds: string[] }
  | { ok: false; status: 400 | 404 | 409; error: string; code?: string }

/**
 * Grava o resultado. Deve rodar numa transação: trava a linha da partida (`FOR UPDATE`), então
 * resultado, placar ao vivo e início/fim de partida da mesma partida se serializam.
 */
export async function saveMatchResult(ex: Executor, matchId: string, body: ResultInput): Promise<SaveResultOutcome> {
  const [match] = await ex.select().from(matches).where(eq(matches.id, matchId)).for('update')
  if (!match) return { ok: false, status: 404, error: 'Match not found' }

  // Torneio encerrado: mudar resultado deixaria final_placement e pontos desatualizados.
  const owner = await findOwnerTournament(ex, match.drawId)
  if (owner && isTournamentLocked(owner.status)) {
    return { ok: false, status: 409, error: TOURNAMENT_LOCKED_MESSAGE, code: 'TOURNAMENT_LOCKED' }
  }

  // Grupos e suíço: trava a chave (a mesma trava da geração da fase seguinte) antes de checar as travas abaixo.
  if (match.stage === 'group' || match.stage === 'swiss') {
    await ex.select({ id: draws.id }).from(draws).where(eq(draws.id, match.drawId)).for('update')
  }

  // Grupos + eliminatória: depois que a eliminatória existe, mudar um resultado dos grupos desatualizaria os classificados.
  if (match.stage === 'group') {
    const [knockout] = await ex.select({ id: matches.id }).from(matches)
      .where(and(eq(matches.drawId, match.drawId), eq(matches.stage, 'knockout'))).limit(1)
    if (knockout) {
      return { ok: false, status: 409, error: 'A eliminatória já foi gerada. Refaça a chave para alterar resultados dos grupos.', code: 'GROUPS_LOCKED' }
    }
  }

  // Suíço: depois que a rodada seguinte existe, mudar uma anterior desmancharia os pareamentos.
  if (match.stage === 'swiss') {
    const [later] = await ex.select({ id: matches.id }).from(matches)
      .where(and(eq(matches.drawId, match.drawId), lt(matches.round, match.round))).limit(1)
    if (later) {
      return { ok: false, status: 409, error: 'A próxima rodada já foi gerada. Refaça a chave para alterar resultados de rodadas anteriores.', code: 'ROUND_LOCKED' }
    }
  }

  const newWinner = getWinnerSlot(body.sets)
  if (!newWinner) return { ok: false, status: 400, error: 'Cannot determine winner from sets' }
  const newWinnerRegId = newWinner === 1 ? match.registration1Id : match.registration2Id

  const newLoserRegId = newWinner === 1 ? match.registration2Id : match.registration1Id

  const prevResults = await ex.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
  const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id
  const prevLoserRegId = prevWinner === 1 ? match.registration2Id : match.registration1Id
  const winnerChanged = prevResults.length > 0 && prevWinnerRegId !== newWinnerRegId

  const resetMatchIds: string[] = []
  if (winnerChanged) {
    if (match.nextMatchId) await cascadeReset(ex, match.nextMatchId, prevWinnerRegId, resetMatchIds)
    // Eliminação dupla: o perdedor anterior também sai da partida para onde tinha caído.
    if (match.loserNextMatchId) await cascadeReset(ex, match.loserNextMatchId, prevLoserRegId, resetMatchIds)
  }
  if (prevResults.length) await ex.delete(matchResults).where(eq(matchResults.matchId, matchId))

  // Um resultado oficial substitui qualquer placar provisório da partida.
  await ex.delete(matchLiveStates).where(eq(matchLiveStates.matchId, matchId))

  await ex.update(matches).set({ status: body.status, updatedAt: new Date() }).where(eq(matches.id, matchId))
  const results = await ex.insert(matchResults).values(
    body.sets.map((s) => ({ id: randomUUID(), matchId, setNumber: s.setNumber, score1: s.score1, score2: s.score2 })),
  ).returning()

  if (match.nextMatchId) {
    // `nextSlot` guardado (eliminação dupla); sem ele, vale a regra da eliminação simples (posição ímpar = slot 1).
    const column = slotColumn(match.nextSlot, getSlotForPosition(match.position) === 'registration1Id' ? 1 : 2)
    await ex.update(matches).set({ [column]: newWinnerRegId, updatedAt: new Date() }).where(eq(matches.id, match.nextMatchId))
  }
  if (match.loserNextMatchId && newLoserRegId) {
    await ex.update(matches).set({ [slotColumn(match.loserNextSlot, 1)]: newLoserRegId, updatedAt: new Date() }).where(eq(matches.id, match.loserNextMatchId))
  }
  if (match.stage === 'grand_final') await syncGrandFinalReset(ex, match, newWinner, resetMatchIds)

  return { ok: true, match: { ...match, status: body.status }, results, tournamentId: owner?.id ?? null, resetMatchIds }
}

function slotColumn(slot: number | null | undefined, fallback: 1 | 2): 'registration1Id' | 'registration2Id' {
  return (slot ?? fallback) === 1 ? 'registration1Id' : 'registration2Id'
}

/** Limpa a partida de reset da grande final (resultado, placar provisório e participantes). */
async function clearResetMatch(ex: Executor, drawId: string, resetMatchIds: string[]): Promise<void> {
  const [reset] = await ex.select().from(matches).where(and(eq(matches.drawId, drawId), eq(matches.stage, 'grand_final_reset')))
  if (!reset || (reset.registration1Id === null && reset.registration2Id === null)) return
  await ex.delete(matchResults).where(eq(matchResults.matchId, reset.id))
  await ex.delete(matchLiveStates).where(eq(matchLiveStates.matchId, reset.id))
  await ex.update(matches).set({ registration1Id: null, registration2Id: null, status: 'pending', updatedAt: new Date() }).where(eq(matches.id, reset.id))
  resetMatchIds.push(reset.id)
}

/**
 * Grande final com reset: se quem veio da chave dos perdedores (lado 2) vence, os dois jogam de novo na partida de
 * reset; se o campeão dos vencedores vence, não há reset. Mudar o resultado desfaz o que dependia dele.
 */
async function syncGrandFinalReset(ex: Executor, final: MatchRow, winnerSlot: 1 | 2, resetMatchIds: string[]): Promise<void> {
  const [reset] = await ex.select().from(matches).where(and(eq(matches.drawId, final.drawId), eq(matches.stage, 'grand_final_reset')))
  if (!reset) return
  if (winnerSlot !== 2) {
    await clearResetMatch(ex, final.drawId, resetMatchIds)
    return
  }
  const same = reset.registration1Id === final.registration1Id && reset.registration2Id === final.registration2Id
  if (same) return
  await clearResetMatch(ex, final.drawId, resetMatchIds)
  await ex.update(matches)
    .set({ registration1Id: final.registration1Id, registration2Id: final.registration2Id, status: 'pending', updatedAt: new Date() })
    .where(eq(matches.id, reset.id))
}

async function cascadeReset(ex: Executor, matchId: string, regIdToRemove: string | null, resetMatchIds: string[]): Promise<void> {
  const [match] = await ex.select().from(matches).where(eq(matches.id, matchId))
  if (!match) return
  const isSlot1 = match.registration1Id === regIdToRemove
  const isSlot2 = match.registration2Id === regIdToRemove
  if (!isSlot1 && !isSlot2) return
  const prevResults = await ex.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
  const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id
  const prevLoserRegId = prevWinner === 1 ? match.registration2Id : match.registration1Id
  await ex.delete(matchResults).where(eq(matchResults.matchId, matchId))
  // Partida seguinte que estava ao vivo perde o adversário: o placar provisório deixa de valer.
  await ex.delete(matchLiveStates).where(eq(matchLiveStates.matchId, matchId))
  await ex.update(matches)
    .set({ [isSlot1 ? 'registration1Id' : 'registration2Id']: null, status: 'pending', updatedAt: new Date() })
    .where(eq(matches.id, matchId))
  resetMatchIds.push(matchId)
  if (match.nextMatchId && prevWinnerRegId) await cascadeReset(ex, match.nextMatchId, prevWinnerRegId, resetMatchIds)
  if (match.loserNextMatchId && prevLoserRegId && prevResults.length) await cascadeReset(ex, match.loserNextMatchId, prevLoserRegId, resetMatchIds)
  // A grande final perdeu um participante: o reset (se existia) não vale mais.
  if (match.stage === 'grand_final') await clearResetMatch(ex, match.drawId, resetMatchIds)
}
