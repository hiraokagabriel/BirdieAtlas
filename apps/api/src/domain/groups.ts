import { randomUUID } from 'crypto'
import { buildMatchDefs, buildSlots, type MatchDef } from './bracket.js'
import { computePlacements, type PlacementMatch, type PlacementSet } from './placements.js'
import { buildRoundRobinMatchDefs, computeRoundRobinStandings, type RoundRobinRow } from './round-robin.js'

// Grupos + eliminatória. Funções puras.
//
// Uma categoria tem UMA chave (draw) com duas fases:
//   1. grupos (`stage: 'group'`): cada grupo joga todos contra todos;
//   2. eliminatória (`stage: 'knockout'`): criada depois, quando os grupos terminam, com os classificados.
// Convenção de `round` (maior = jogada antes): a eliminatória usa K..1 (1 é a final) e as rodadas dos grupos
// ficam acima de K, para que agendador e fila ao vivo ordenem por fase sem conhecer o formato.

export const MAX_GROUPS = 26

export interface GroupConfig {
  groupCount: number
  advancePerGroup: number
}

export interface GroupPlan extends GroupConfig {
  /** Tamanho de cada grupo, em ordem (A, B, C...). */
  sizes: number[]
  /** Classificados no total. */
  qualifiers: number
  /** Tamanho da chave eliminatória (potência de 2). */
  bracketSize: number
  /** Rodadas da eliminatória (a final é a rodada 1). */
  knockoutRounds: number
}

export type GroupPlanResult = { ok: true; plan: GroupPlan } | { ok: false; error: string }

export interface GroupPlanInput {
  entries: number
  groupCount?: number | undefined
  /** Pessoas por grupo (alvo): define o número de grupos quando `groupCount` não vem. */
  groupSize?: number | undefined
  advancePerGroup?: number | undefined
}

export function groupLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

/** Valida e completa a configuração. Padrões: grupos de ~4 pessoas e 2 classificados por grupo. */
export function planGroups(input: GroupPlanInput): GroupPlanResult {
  const { entries } = input
  if (entries < 4) return { ok: false, error: 'Grupos + eliminatória precisa de pelo menos 4 inscritos aprovados.' }

  let groupCount = input.groupCount
  if (groupCount === undefined) {
    const size = input.groupSize ?? 4
    if (!Number.isInteger(size) || size < 2) return { ok: false, error: 'Cada grupo precisa de pelo menos 2 pessoas.' }
    groupCount = Math.max(1, Math.ceil(entries / size))
  }
  if (!Number.isInteger(groupCount) || groupCount < 1) return { ok: false, error: 'Informe pelo menos 1 grupo.' }
  if (groupCount > MAX_GROUPS) return { ok: false, error: `No máximo ${MAX_GROUPS} grupos.` }
  if (groupCount * 2 > entries) return { ok: false, error: `Com ${entries} inscritos, o máximo é ${Math.floor(entries / 2)} grupos (cada um precisa de pelo menos 2 pessoas).` }

  const base = Math.floor(entries / groupCount)
  const extra = entries % groupCount
  const sizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0))
  const smallest = Math.min(...sizes)

  const advancePerGroup = input.advancePerGroup ?? Math.min(2, smallest - 1)
  if (!Number.isInteger(advancePerGroup) || advancePerGroup < 1) return { ok: false, error: 'Pelo menos 1 classificado por grupo.' }
  if (advancePerGroup >= smallest) {
    return { ok: false, error: `O menor grupo tem ${smallest} pessoas: classifique no máximo ${smallest - 1} por grupo.` }
  }

  const qualifiers = groupCount * advancePerGroup
  if (qualifiers < 2) return { ok: false, error: 'A eliminatória precisa de pelo menos 2 classificados.' }
  const bracketSize = 2 ** Math.ceil(Math.log2(qualifiers))
  return { ok: true, plan: { groupCount, advancePerGroup, sizes, qualifiers, bracketSize, knockoutRounds: Math.log2(bracketSize) } }
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
 * Distribui as inscrições nos grupos. `seeded`: cabeças de chave primeiro, em serpentina (A, B, C, C, B, A...),
 * e o resto sorteado; `random`: tudo sorteado. Os tamanhos seguem `sizes` (grupos iniciais ficam com uma pessoa a mais).
 */
export function distributeToGroups(
  entries: readonly { id: string; seed: number | null }[],
  sizes: readonly number[],
  mode: 'random' | 'seeded',
): string[][] {
  const seeded = mode === 'seeded' ? [...entries].filter((e) => e.seed !== null).sort((a, b) => a.seed! - b.seed!) : []
  const rest = shuffled(entries.filter((e) => !seeded.includes(e)))
  const ordered = [...seeded, ...rest]

  const groups: string[][] = sizes.map(() => [])
  const count = sizes.length
  // Serpentina: 0..c-1, c-1..0, 0..c-1... pulando grupos já cheios (o total das vagas é igual ao de inscritos).
  function* snake(): Generator<number> {
    for (;;) {
      for (let i = 0; i < count; i++) yield i
      for (let i = count - 1; i >= 0; i--) yield i
    }
  }
  const order = snake()
  for (const entry of ordered) {
    let index = order.next().value as number
    while (groups[index]!.length >= sizes[index]!) index = order.next().value as number
    groups[index]!.push(entry.id)
  }
  return groups
}

/** Partidas da fase de grupos. `round` = knockoutRounds + (rodadas dos grupos - jogada + 1). */
export function buildGroupMatchDefs(drawId: string, groups: readonly (readonly string[])[], knockoutRounds: number): MatchDef[] {
  const perGroup = groups.map((ids, i) => ({ key: groupLetter(i), defs: buildRoundRobinMatchDefs(drawId, ids) }))
  // Rodadas jogadas de cada grupo (1..R), R = maior número de rodadas entre os grupos.
  const playedRounds = Math.max(...perGroup.map((g) => g.defs.reduce((max, m) => Math.max(max, m.round), 0)))
  const out: MatchDef[] = []
  const nextPosition = new Map<number, number>()
  for (const group of perGroup) {
    const groupRounds = group.defs.reduce((max, m) => Math.max(max, m.round), 0)
    for (const def of group.defs) {
      // def.round: maior = jogada antes, dentro do grupo (groupRounds..1). Rodada jogada = groupRounds - def.round + 1.
      const played = groupRounds - def.round + 1
      const round = knockoutRounds + (playedRounds - played + 1)
      const position = (nextPosition.get(round) ?? 0) + 1
      nextPosition.set(round, position)
      out.push({ ...def, id: randomUUID(), round, position, roundLabel: `Grupo ${group.key} · Rodada ${played}`, groupKey: group.key, stage: 'group' })
    }
  }
  return out
}

export interface GroupMatchLike {
  id: string
  groupKey?: string | null
  stage?: string | null
  registration1Id: string | null
  registration2Id: string | null
}

export interface GroupStandings {
  key: string
  rows: (RoundRobinRow & { position: number })[]
}

/** Classificação de cada grupo (A, B, C...), só com as partidas da fase de grupos. */
export function computeGroupStandings(
  matches: readonly GroupMatchLike[],
  setsByMatchId: ReadonlyMap<string, readonly PlacementSet[]>,
): GroupStandings[] {
  const byGroup = new Map<string, GroupMatchLike[]>()
  for (const m of matches) {
    if (m.stage !== 'group' || !m.groupKey) continue
    byGroup.set(m.groupKey, [...(byGroup.get(m.groupKey) ?? []), m])
  }
  return [...byGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      const ids = [...new Set(list.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))]
      return { key, rows: computeRoundRobinStandings(ids, list, setsByMatchId).map((row, i) => ({ ...row, position: i + 1 })) }
    })
}

export interface Qualifier {
  id: string
  seed: number
  groupKey: string
  groupRank: number
}

/**
 * Classificados: os `advance` primeiros de cada grupo. Cabeças da eliminatória: primeiro todos os 1º colocados
 * (na ordem dos grupos), depois os 2º, e assim por diante.
 */
export function pickQualifiers(standings: readonly GroupStandings[], advance: number): Qualifier[] {
  const out: Qualifier[] = []
  let seed = 1
  for (let rank = 1; rank <= advance; rank++) {
    for (const group of standings) {
      const row = group.rows[rank - 1]
      if (row) out.push({ id: row.registrationId, seed: seed++, groupKey: group.key, groupRank: rank })
    }
  }
  return out
}

function firstRoundConflicts(defs: readonly MatchDef[], groupOf: ReadonlyMap<string, string>): number {
  const firstRound = Math.max(...defs.map((d) => d.round))
  return defs.filter((d) => {
    if (d.round !== firstRound || !d.registration1Id || !d.registration2Id) return false
    return groupOf.get(d.registration1Id) === groupOf.get(d.registration2Id)
  }).length
}

/** Chave eliminatória dos classificados; tenta evitar que colegas de grupo se enfrentem na primeira fase. */
export function buildKnockoutMatchDefs(drawId: string, qualifiers: readonly Qualifier[]): MatchDef[] {
  const groupOf = new Map(qualifiers.map((q) => [q.id, q.groupKey]))
  const entries = qualifiers.map((q) => ({ id: q.id, seed: q.seed }))
  let best: MatchDef[] | null = null
  let bestConflicts = Infinity
  for (let attempt = 0; attempt < 60 && bestConflicts > 0; attempt++) {
    const defs = buildMatchDefs(drawId, buildSlots(entries, 'seeded'))
    const conflicts = firstRoundConflicts(defs, groupOf)
    if (conflicts < bestConflicts) {
      best = defs
      bestConflicts = conflicts
    }
  }
  return (best ?? buildMatchDefs(drawId, buildSlots(entries, 'seeded'))).map((d) => ({ ...d, stage: 'knockout' as const }))
}

const FINISHED = ['completed', 'walkover', 'retired']

function isPending(m: { status: string; registration1Id: string | null; registration2Id: string | null }): boolean {
  return !FINISHED.includes(m.status) && m.registration1Id !== null && m.registration2Id !== null
}

/** A chave está pronta para encerrar? Grupos + eliminatória exige a eliminatória criada e toda jogada. */
export function isDrawFinished(
  format: string,
  matches: readonly { status: string; stage?: string | null; registration1Id: string | null; registration2Id: string | null }[],
): boolean {
  if (matches.length === 0) return false
  if (matches.some(isPending)) return false
  if (format === 'group_then_elimination') return matches.some((m) => m.stage === 'knockout')
  return true
}

/**
 * Colocação: a eliminatória decide como na eliminação simples (1º, 2º, 3º, 5º, 9º...). Quem caiu na fase de grupos
 * fica em `bracketSize + 1`, empatado, como quem perde a primeira fase de uma chave desse tamanho.
 */
export function computeGroupKnockoutPlacements(
  matches: readonly (PlacementMatch & { stage?: string | null })[],
  setsByMatchId: Map<string, PlacementSet[]>,
): Map<string, number> {
  const knockout = matches.filter((m) => m.stage === 'knockout')
  const placements = computePlacements(knockout, setsByMatchId)
  const inKnockout = new Set(knockout.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))
  const bracketSize = knockout.length ? 2 ** Math.max(...knockout.map((m) => m.round)) : 0
  for (const m of matches) {
    if (m.stage !== 'group') continue
    for (const id of [m.registration1Id, m.registration2Id]) {
      if (id !== null && !inKnockout.has(id) && !placements.has(id)) placements.set(id, bracketSize + 1)
    }
  }
  return placements
}
