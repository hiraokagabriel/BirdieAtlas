import { randomUUID } from 'crypto'
import type { MatchDef } from './bracket.js'

// Sistema suíço. Funções puras.
//
// Todas jogam o mesmo número de rodadas. A rodada 1 emparelha por cabeça de chave (ou sorteio); as
// seguintes são geradas uma a uma, depois que a anterior termina: pareamento por vitórias, sem repetir
// adversário quando possível. Número ímpar: uma pessoa folga por rodada (bye, conta como vitória) e
// ninguém folga duas vezes enquanto houver quem ainda não folgou.
//
// `round` segue a convenção das outras chaves (maior = jogada antes): com `totalRounds` fixo, a rodada
// jogada k tem `round = totalRounds - k + 1`. O texto fica em `roundLabel` ("Rodada 2").

export interface SwissPlanInput {
  entries: number
  rounds?: number | undefined
}

export type SwissPlanResult = { ok: true; rounds: number } | { ok: false; error: string }

/** Padrão: ⌈log₂ inscritos⌉ rodadas (mínimo 1); no máximo inscritos - 1 (cada um enfrenta cada outro no máximo uma vez). */
export function planSwiss({ entries, rounds }: SwissPlanInput): SwissPlanResult {
  if (entries < 3) return { ok: false, error: 'O suíço precisa de pelo menos 3 inscritos aprovados.' }
  const maxRounds = entries - 1
  const chosen = rounds ?? Math.min(maxRounds, Math.max(1, Math.ceil(Math.log2(entries))))
  if (!Number.isInteger(chosen) || chosen < 1) return { ok: false, error: 'Informe pelo menos 1 rodada.' }
  if (chosen > maxRounds) return { ok: false, error: `Com ${entries} inscritos, o máximo é ${maxRounds} rodadas (ninguém repete adversário).` }
  return { ok: true, rounds: chosen }
}

export const swissRoundLabel = (playedOrder: number) => `Rodada ${playedOrder}`

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

export interface SwissRow {
  registrationId: string
  played: number
  wins: number
  losses: number
  byes: number
  setsFor: number
  setsAgainst: number
  pointsFor: number
  pointsAgainst: number
  /** Soma das vitórias dos adversários enfrentados (desempate clássico do suíço). */
  buchholz: number
}

export interface SwissMatch {
  id: string
  registration1Id: string | null
  registration2Id: string | null
  status?: string
}

export interface SwissSet {
  score1: number
  score2: number
}

/**
 * Classificação do suíço: vitórias (bye conta como vitória), depois Buchholz, saldo de sets, saldo de pontos
 * e, por fim, o id (ordem estável). Só entram partidas com vencedor definido pelos sets.
 */
export function computeSwissStandings(
  registrationIds: readonly string[],
  matches: readonly SwissMatch[],
  setsByMatchId: ReadonlyMap<string, readonly SwissSet[]>,
): SwissRow[] {
  const rows = new Map<string, SwissRow>(
    registrationIds.map((id) => [id, { registrationId: id, played: 0, wins: 0, losses: 0, byes: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0, buchholz: 0 }]),
  )
  const opponents = new Map<string, string[]>()

  for (const m of matches) {
    const { registration1Id: r1, registration2Id: r2 } = m
    // Bye: um lado só.
    if ((r1 === null) !== (r2 === null)) {
      const row = rows.get((r1 ?? r2)!)
      if (row) { row.byes++; row.wins++; row.played++ }
      continue
    }
    if (!r1 || !r2) continue
    const sets = setsByMatchId.get(m.id) ?? []
    const w1 = sets.filter((s) => s.score1 > s.score2).length
    const w2 = sets.filter((s) => s.score2 > s.score1).length
    if (sets.length === 0 || w1 === w2) continue
    const p1 = sets.reduce((sum, s) => sum + s.score1, 0)
    const p2 = sets.reduce((sum, s) => sum + s.score2, 0)
    const a = rows.get(r1)
    const b = rows.get(r2)
    if (!a || !b) continue
    a.played++; b.played++
    a.setsFor += w1; a.setsAgainst += w2; b.setsFor += w2; b.setsAgainst += w1
    a.pointsFor += p1; a.pointsAgainst += p2; b.pointsFor += p2; b.pointsAgainst += p1
    if (w1 > w2) { a.wins++; b.losses++ } else { b.wins++; a.losses++ }
    opponents.set(r1, [...(opponents.get(r1) ?? []), r2])
    opponents.set(r2, [...(opponents.get(r2) ?? []), r1])
  }
  for (const row of rows.values()) {
    row.buchholz = (opponents.get(row.registrationId) ?? []).reduce((sum, id) => sum + (rows.get(id)?.wins ?? 0), 0)
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.buchholz - a.buchholz ||
      b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
      b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
      a.registrationId.localeCompare(b.registrationId),
  )
}

export interface SwissPairing {
  pairs: [string, string][]
  bye: string | null
  /** Houve repetição de adversário porque não havia pareamento sem repetir. */
  rematches: number
}

/**
 * Pareia a próxima rodada. `ranked` está em ordem de classificação (melhor primeiro). Escolhe o bye (se o número
 * é ímpar) entre os piores colocados que ainda não folgaram e busca, com retrocesso, o pareamento que une os
 * mais próximos na tabela sem repetir adversário; se não existir, aceita o mínimo de repetições.
 */
export function pairSwissRound(
  ranked: readonly string[],
  played: ReadonlySet<string>,
  byeHistory: ReadonlySet<string>,
): SwissPairing {
  const order = [...ranked]
  let bye: string | null = null
  if (order.length % 2 === 1) {
    const candidates = [...order].reverse()
    bye = candidates.find((id) => !byeHistory.has(id)) ?? candidates[0]!
    order.splice(order.indexOf(bye), 1)
  }

  function search(pool: string[], allowRematch: boolean, budget: { left: number }): [string, string][] | null {
    if (pool.length === 0) return []
    if (budget.left-- <= 0) return null
    const [first, ...rest] = pool as [string, ...string[]]
    for (let i = 0; i < rest.length; i++) {
      const other = rest[i]!
      if (!allowRematch && played.has(pairKey(first, other))) continue
      const remaining = rest.filter((_, idx) => idx !== i)
      const tail = search(remaining, allowRematch, budget)
      if (tail) return [[first, other], ...tail]
    }
    return null
  }

  const strict = search(order, false, { left: 200_000 })
  if (strict) return { pairs: strict, bye, rematches: 0 }

  // Sem pareamento limpo: guloso, preferindo adversários novos.
  const pool = [...order]
  const pairs: [string, string][] = []
  let rematches = 0
  while (pool.length > 0) {
    const first = pool.shift()!
    let idx = pool.findIndex((id) => !played.has(pairKey(first, id)))
    if (idx === -1) { idx = 0; rematches++ }
    pairs.push([first, pool.splice(idx, 1)[0]!])
  }
  return { pairs, bye, rematches }
}

function matchDef(
  drawId: string,
  totalRounds: number,
  playedOrder: number,
  position: number,
  reg1: string | null,
  reg2: string | null,
): MatchDef {
  return {
    id: randomUUID(),
    drawId,
    round: totalRounds - playedOrder + 1,
    position,
    registration1Id: reg1,
    registration2Id: reg2,
    nextMatchId: null,
    status: reg1 === null || reg2 === null ? 'walkover' : 'pending',
    roundLabel: swissRoundLabel(playedOrder),
    stage: 'swiss',
  }
}

/** Partidas de uma rodada a partir do pareamento; o bye vira uma partida de um lado só, já encerrada (W.O.). */
export function buildSwissRoundDefs(drawId: string, totalRounds: number, playedOrder: number, pairing: SwissPairing): MatchDef[] {
  const defs = pairing.pairs.map(([a, b], i) => matchDef(drawId, totalRounds, playedOrder, i + 1, a, b))
  if (pairing.bye) defs.push(matchDef(drawId, totalRounds, playedOrder, pairing.pairs.length + 1, pairing.bye, null))
  return defs
}

/** Rodada 1: cabeças de chave primeiro (melhor contra o do meio da lista), o resto sorteado. */
export function pairFirstRound(entries: readonly { id: string; seed: number | null }[], mode: 'random' | 'seeded'): SwissPairing {
  const seeded = mode === 'seeded' ? [...entries].filter((e) => e.seed !== null).sort((a, b) => a.seed! - b.seed!) : []
  const rest = entries.filter((e) => !seeded.includes(e)).map((e) => ({ e, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.e)
  const ordered = [...seeded, ...rest].map((e) => e.id)
  let bye: string | null = null
  if (ordered.length % 2 === 1) bye = ordered.pop() ?? null
  const half = ordered.length / 2
  const pairs: [string, string][] = Array.from({ length: half }, (_, i) => [ordered[i]!, ordered[i + half]!])
  return { pairs, bye, rematches: 0 }
}

/** Quantas rodadas já foram geradas (rodadas jogadas distintas) e o total configurado. */
export function swissProgress(matches: readonly { round: number }[], totalRounds: number): { generated: number; total: number } {
  return { generated: new Set(matches.map((m) => m.round)).size, total: totalRounds }
}

/** Colocação final = posição na classificação. */
export function computeSwissPlacements(
  matches: readonly SwissMatch[],
  setsByMatchId: ReadonlyMap<string, readonly SwissSet[]>,
): Map<string, number> {
  const ids = [...new Set(matches.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))]
  const placements = new Map<string, number>()
  computeSwissStandings(ids, matches, setsByMatchId).forEach((row, i) => placements.set(row.registrationId, i + 1))
  return placements
}
