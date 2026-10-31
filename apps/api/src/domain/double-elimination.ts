import { randomUUID } from 'crypto'
import { buildMatchDefs, type MatchDef } from './bracket.js'
import type { PlacementMatch, PlacementSet } from './placements.js'

// Eliminação dupla. Funções puras.
//
// Quem perde uma vez cai para a chave dos perdedores; perde duas, sai. A chave dos vencedores é a mesma
// da eliminação simples (`buildMatchDefs`); a dos perdedores recebe os perdedores de cada rodada dos
// vencedores. A grande final enfrenta os campeões das duas chaves; com `reset`, se quem veio dos
// perdedores vencer, joga-se uma segunda grande final (cada lado já tem uma derrota).
//
// Cada partida guarda para onde vai o vencedor (`nextMatchId` + `nextSlot`) e o perdedor
// (`loserNextMatchId` + `loserNextSlot`). Partidas que teriam um só participante (byes da primeira rodada)
// não são criadas: o participante é encaminhado direto para a partida seguinte.
//
// `round` segue a convenção das outras chaves (maior = jogada antes), calculada pela profundidade da partida
// no grafo (1 + a maior profundidade das que a alimentam), para o agendador ordenar por fase.

export const MIN_DOUBLE_ELIMINATION_ENTRIES = 3
export const MAX_DOUBLE_ELIMINATION_ENTRIES = 64

export type DoubleEliminationPlan = { ok: true; bracketSize: number; knockoutRounds: number } | { ok: false; error: string }

export function planDoubleElimination(entries: number): DoubleEliminationPlan {
  if (entries < MIN_DOUBLE_ELIMINATION_ENTRIES) return { ok: false, error: 'A eliminação dupla precisa de pelo menos 3 inscritos aprovados.' }
  if (entries > MAX_DOUBLE_ELIMINATION_ENTRIES) return { ok: false, error: `A eliminação dupla aceita no máximo ${MAX_DOUBLE_ELIMINATION_ENTRIES} inscritos.` }
  const bracketSize = 2 ** Math.ceil(Math.log2(entries))
  return { ok: true, bracketSize, knockoutRounds: Math.log2(bracketSize) }
}

/** Ordem clássica de cabeças: [1, S, S/2, S/2+1, ...] — posições adjacentes formam as partidas da 1ª rodada. */
function classicSeedOrder(size: number): number[] {
  let order = [1, 2]
  while (order.length < size) {
    const next = order.length * 2
    order = order.flatMap((seed) => [seed, next + 1 - seed])
  }
  return order
}

function shuffled<T>(list: readonly T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/**
 * Posições da chave dos vencedores no formato que `buildMatchDefs` espera (a partida p une os slots p-1 e S-p).
 * Cabeças primeiro (ou tudo sorteado), na ordem clássica: os melhores recebem os byes.
 */
function winnersSlots(entries: readonly { id: string; seed: number | null }[], size: number, mode: 'random' | 'seeded'): (string | null)[] {
  const seeded = mode === 'seeded' ? [...entries].filter((e) => e.seed !== null).sort((a, b) => a.seed! - b.seed!) : []
  const rest = shuffled(entries.filter((e) => !seeded.includes(e)))
  const ranked = [...seeded, ...rest].map((e) => e.id)
  const order = classicSeedOrder(size)
  const slots: (string | null)[] = new Array(size).fill(null)
  for (let p = 1; p <= size / 2; p++) {
    slots[p - 1] = ranked[order[2 * (p - 1)]! - 1] ?? null
    slots[size - p] = ranked[order[2 * (p - 1) + 1]! - 1] ?? null
  }
  return slots
}

type Ref = { owner: MatchDef; kind: 'winner' | 'loser' } | null

const slotOf = (position: number): 1 | 2 => (position % 2 === 1 ? 1 : 2)

function wbLabel(wi: number, k: number): string {
  if (wi === k) return 'Final dos vencedores'
  if (wi === k - 1) return 'Semifinal dos vencedores'
  return `Vencedores · Rodada ${wi}`
}

function lbLabel(j: number, total: number): string {
  return j === total ? 'Final dos perdedores' : `Perdedores · Rodada ${j}`
}

export function buildDoubleEliminationDefs(
  drawId: string,
  entries: readonly { id: string; seed: number | null }[],
  mode: 'random' | 'seeded',
  reset: boolean,
): MatchDef[] {
  const plan = planDoubleElimination(entries.length)
  if (!plan.ok) throw new Error(plan.error)
  const { bracketSize: size, knockoutRounds: k } = plan

  // ----- Chave dos vencedores
  const wb = buildMatchDefs(drawId, winnersSlots(entries, size, mode)).map((m) => ({
    ...m,
    stage: 'winners' as const,
    nextSlot: m.nextMatchId ? slotOf(m.position) : null,
    loserNextMatchId: null as string | null,
    loserNextSlot: null as number | null,
    roundLabel: wbLabel(k - m.round + 1, k),
  }))
  const wbAt = (wi: number, index: number) => wb.find((m) => m.round === k - wi + 1 && m.position === index)!
  const isTwoPlayer = (m: MatchDef) => m.registration1Id !== null && m.registration2Id !== null

  const winnerRef = (m: MatchDef): Ref => ({ owner: m, kind: 'winner' })
  /** Perdedor de uma partida dos vencedores: só existe se a partida tem dois participantes (byes não geram perdedor). */
  const loserRef = (m: MatchDef): Ref => (isTwoPlayer(m) || m.round !== k ? { owner: m, kind: 'loser' } : null)

  // ----- Chave dos perdedores (rodadas de 1 a 2k-2), com os nós que só teriam um participante eliminados
  const lbTotal = 2 * k - 2
  const lbMatches: MatchDef[] = []
  const lbResolved: Ref[][] = [] // lbResolved[j][i-1] = de onde sai o vencedor do nó (j, i), já resolvido
  const inputsOf = new Map<MatchDef, [Ref, Ref]>()

  function makeNode(j: number, i: number, a: Ref, b: Ref): Ref {
    if (a && b) {
      const def: MatchDef = {
        id: randomUUID(), drawId, round: 0, position: i, registration1Id: null, registration2Id: null,
        nextMatchId: null, status: 'pending', roundLabel: lbLabel(j, lbTotal), stage: 'losers',
        nextSlot: null, loserNextMatchId: null, loserNextSlot: null,
      }
      lbMatches.push(def)
      inputsOf.set(def, [a, b])
      return winnerRef(def)
    }
    return a ?? b // passagem direta (um participante) ou vazio (nenhum)
  }

  for (let j = 1; j <= lbTotal; j++) {
    const row: Ref[] = []
    if (j === 1) {
      for (let i = 1; i <= size / 4; i++) {
        row.push(makeNode(j, i, loserRef(wbAt(1, 2 * i - 1)), loserRef(wbAt(1, 2 * i))))
      }
    } else if (j % 2 === 0) {
      const m = j / 2
      const count = size / 2 ** (m + 1)
      for (let i = 1; i <= count; i++) {
        // Os perdedores da rodada m+1 dos vencedores entram em ordem invertida na primeira queda (evita revanche imediata).
        const dropIndex = m % 2 === 1 ? count - i + 1 : i
        row.push(makeNode(j, i, lbResolved[j - 2]![i - 1] ?? null, loserRef(wbAt(m + 1, dropIndex))))
      }
    } else {
      const prev = lbResolved[j - 2]!
      for (let i = 1; i <= prev.length / 2; i++) {
        row.push(makeNode(j, i, prev[2 * i - 2] ?? null, prev[2 * i - 1] ?? null))
      }
    }
    lbResolved[j - 1] = row
  }

  // ----- Grande final (e reset)
  const wbFinal = wbAt(k, 1)
  const lbChampion = lbResolved[lbTotal - 1]![0] ?? null
  const gf1: MatchDef = {
    id: randomUUID(), drawId, round: 0, position: 1, registration1Id: null, registration2Id: null,
    nextMatchId: null, status: 'pending', roundLabel: 'Grande final', stage: 'grand_final',
    nextSlot: null, loserNextMatchId: null, loserNextSlot: null,
  }
  inputsOf.set(gf1, [winnerRef(wbFinal), lbChampion])
  const all: MatchDef[] = [...wb, ...lbMatches, gf1]
  let gf2: MatchDef | null = null
  if (reset) {
    gf2 = {
      id: randomUUID(), drawId, round: 0, position: 1, registration1Id: null, registration2Id: null,
      nextMatchId: null, status: 'pending', roundLabel: 'Grande final (reset)', stage: 'grand_final_reset',
      nextSlot: null, loserNextMatchId: null, loserNextSlot: null,
    }
    all.push(gf2)
  }

  // ----- Ponteiros: cada entrada de uma partida aponta de volta para a partida de origem
  for (const [node, [a, b]] of inputsOf) {
    ;([a, b] as Ref[]).forEach((ref, index) => {
      if (!ref) return
      const slot = (index + 1) as 1 | 2
      if (ref.kind === 'winner') {
        ref.owner.nextMatchId = node.id
        ref.owner.nextSlot = slot
      } else {
        ref.owner.loserNextMatchId = node.id
        ref.owner.loserNextSlot = slot
      }
    })
  }

  // ----- Rodadas pela profundidade (1 + maior profundidade de quem alimenta a partida)
  const feeders = new Map<string, MatchDef[]>()
  const addFeeder = (target: string | null | undefined, from: MatchDef) => {
    if (target) feeders.set(target, [...(feeders.get(target) ?? []), from])
  }
  for (const m of all) {
    addFeeder(m.nextMatchId, m)
    addFeeder(m.loserNextMatchId, m)
  }
  if (gf2) addFeeder(gf2.id, gf1)
  const depthOf = new Map<string, number>()
  const depth = (m: MatchDef): number => {
    const cached = depthOf.get(m.id)
    if (cached) return cached
    const d = 1 + Math.max(0, ...(feeders.get(m.id) ?? []).map(depth))
    depthOf.set(m.id, d)
    return d
  }
  const maxDepth = Math.max(...all.map(depth))
  for (const m of all) m.round = maxDepth - depth(m) + 1
  return all
}

// ---------------------------------------------------------------------------
// Colocação
// ---------------------------------------------------------------------------

export interface DoubleEliminationMatch extends PlacementMatch {
  stage?: string | null
}

function decide(match: DoubleEliminationMatch, sets: PlacementSet[]): { winner: string; loser: string } | null {
  const { registration1Id: a, registration2Id: b } = match
  if (!a || !b) return null
  const w1 = sets.filter((s) => s.score1 > s.score2).length
  const w2 = sets.filter((s) => s.score2 > s.score1).length
  if (w1 === w2) return null
  return w1 > w2 ? { winner: a, loser: b } : { winner: b, loser: a }
}

/**
 * Campeão e vice saem da grande final (ou do reset, quando ele foi jogado). Os demais ficam pela rodada da chave
 * dos perdedores em que caíram: a final dos perdedores é 3º, a rodada anterior 4º, e assim por diante; quem cai na
 * mesma rodada empata (5º, 7º, 9º...).
 */
export function computeDoubleEliminationPlacements(
  matches: readonly DoubleEliminationMatch[],
  setsByMatchId: ReadonlyMap<string, PlacementSet[]>,
): Map<string, number> {
  const placements = new Map<string, number>()
  const reset = matches.find((m) => m.stage === 'grand_final_reset')
  const gf1 = matches.find((m) => m.stage === 'grand_final')
  const decided = (m: DoubleEliminationMatch | undefined) => (m ? decide(m, setsByMatchId.get(m.id) ?? []) : null)

  const resetResult = decided(reset)
  const finalResult = resetResult ?? decided(gf1)
  if (finalResult) {
    placements.set(finalResult.winner, 1)
    placements.set(finalResult.loser, 2)
  }

  const byRound = new Map<number, string[]>()
  for (const m of matches) {
    if (m.stage !== 'losers') continue
    const result = decide(m, setsByMatchId.get(m.id) ?? [])
    if (result) byRound.set(m.round, [...(byRound.get(m.round) ?? []), result.loser])
  }
  let place = 3
  for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
    const losers = byRound.get(round)!
    for (const id of losers) if (!placements.has(id)) placements.set(id, place)
    place += losers.length
  }
  return placements
}
