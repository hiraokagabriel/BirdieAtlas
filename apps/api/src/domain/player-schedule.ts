// Partidas de um jogador num torneio ("Encontre sua próxima partida"): as jogadas, a atual, os byes e a próxima
// condicional ("se vencer"). Regra pura: a rota carrega as partidas, os nomes e os sets.
import { matchRoundLabel } from './schedule.js'

export interface ScheduleMatchInput {
  id: string
  categoryName: string
  round: number
  position: number
  roundLabel: string | null
  status: string
  registration1Id: string | null
  registration2Id: string | null
  nextMatchId: string | null
  /** Eliminação dupla: para onde vai o perdedor. */
  loserNextMatchId?: string | null
  scheduledAt: string | null
  courtNumber: number | null
}

/** `bye`: avança de fase sem jogar (eliminatória). `rest`: folga na rodada, conta como vitória (suíço). */
export type PlayerMatchKind = 'bye' | 'rest' | 'played' | 'live' | 'upcoming'

export interface PlayerMatch {
  matchId: string
  categoryName: string
  roundLabel: string
  kind: PlayerMatchKind
  /** Adversário (nome do atleta ou dupla, "vencedor de A × B" ou "A definir"); `null` em bye e folga. */
  opponent: string | null
  /** Partida jogada (ou bye/folga, que contam como vitória): resultado do ponto de vista do jogador. */
  result: 'won' | 'lost' | null
  /** Sets do ponto de vista do jogador ("21-15 19-21 21-18"). */
  score: string | null
  courtNumber: number | null
  scheduledAt: string | null
  /** Partida seguinte se ele vencer esta (só nas ainda não decididas que levam a outra partida). */
  ifWin: { roundLabel: string; opponent: string } | null
}

const FINISHED = new Set(['completed', 'walkover', 'retired'])

type Sets = readonly { score1: number; score2: number }[]

function winnerSide(sets: Sets): 1 | 2 | null {
  const w1 = sets.filter((s) => s.score1 > s.score2).length
  const w2 = sets.filter((s) => s.score2 > s.score1).length
  return w1 > w2 ? 1 : w2 > w1 ? 2 : null
}

/**
 * Partidas do jogador, por categoria e na ordem em que são jogadas. Em todos os formatos a rodada de número maior
 * é jogada antes (a 1 é a final ou a última rodada), então a ordem é por `round` decrescente.
 * `regIds`: inscrições dele no torneio (simples e duplas).
 */
export function buildPlayerSchedule(
  allMatches: readonly ScheduleMatchInput[],
  regIds: ReadonlySet<string>,
  nameOf: (registrationId: string) => string | null,
  setsOf: (matchId: string) => Sets,
): PlayerMatch[] {
  const byId = new Map(allMatches.map((m) => [m.id, m]))
  const hasMe = (m: ScheduleMatchInput) => Boolean((m.registration1Id && regIds.has(m.registration1Id)) || (m.registration2Id && regIds.has(m.registration2Id)))
  const participants = (m: ScheduleMatchInput) => {
    const names = [m.registration1Id, m.registration2Id].map((id) => (id ? nameOf(id) ?? 'A definir' : null))
    return names.every(Boolean) ? `${names[0]} × ${names[1]}` : null
  }

  /** Lado ainda vazio: quem sai da partida que o alimenta ("vencedor de" ou, na dupla eliminação, "perdedor de"). */
  const awaiting = (target: ScheduleMatchInput, exceptId?: string): string => {
    for (const f of allMatches) {
      if (f.id === exceptId || hasMe(f)) continue
      const via = f.nextMatchId === target.id ? 'vencedor' : f.loserNextMatchId === target.id ? 'perdedor' : null
      const pair = via ? participants(f) : null
      if (pair) return `${via} de ${pair}`
    }
    return 'A definir'
  }

  return allMatches
    .filter(hasMe)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'pt-BR') || b.round - a.round || a.position - b.position)
    .map((m): PlayerMatch => {
      const side: 1 | 2 = m.registration1Id && regIds.has(m.registration1Id) ? 1 : 2
      const opponentId = side === 1 ? m.registration2Id : m.registration1Id
      const sets = setsOf(m.id)
      const free = m.status === 'walkover' && opponentId === null
      // Folga do suíço: rodada com rótulo próprio e sem partida seguinte; o jogador continua na mesma fase.
      const kind: PlayerMatchKind = free
        ? m.roundLabel !== null && m.nextMatchId === null ? 'rest' : 'bye'
        : FINISHED.has(m.status) ? 'played' : m.status === 'in_progress' ? 'live' : 'upcoming'
      const winner = kind === 'played' ? winnerSide(sets) : null

      let ifWin: PlayerMatch['ifWin'] = null
      const next = m.nextMatchId ? byId.get(m.nextMatchId) : undefined
      if ((kind === 'live' || kind === 'upcoming') && next) {
        const nextOpponentId = [next.registration1Id, next.registration2Id].find((id) => id && !regIds.has(id)) ?? null
        ifWin = { roundLabel: matchRoundLabel(next), opponent: nextOpponentId ? nameOf(nextOpponentId) ?? 'A definir' : awaiting(next, m.id) }
      }

      return {
        matchId: m.id,
        categoryName: m.categoryName,
        roundLabel: matchRoundLabel(m),
        kind,
        opponent: free ? null : opponentId ? nameOf(opponentId) ?? 'A definir' : awaiting(m),
        result: free ? 'won' : winner === null ? null : winner === side ? 'won' : 'lost',
        score: sets.length && !free ? sets.map((s) => (side === 1 ? `${s.score1}-${s.score2}` : `${s.score2}-${s.score1}`)).join(' ') : null,
        courtNumber: m.courtNumber,
        scheduledAt: m.scheduledAt,
        ifWin,
      }
    })
}

/**
 * Partida em destaque ("Próxima partida"): a que está ao vivo; senão, entre as a jogar, a de horário mais cedo
 * (sem horário vão depois, na ordem da lista). `null` quando não há nenhuma.
 */
export function nextPlayerMatch(list: readonly PlayerMatch[]): string | null {
  const live = list.find((m) => m.kind === 'live')
  if (live) return live.matchId
  const upcoming = list.filter((m) => m.kind === 'upcoming')
  const timed = upcoming.filter((m) => m.scheduledAt).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))
  return (timed[0] ?? upcoming[0])?.matchId ?? null
}
