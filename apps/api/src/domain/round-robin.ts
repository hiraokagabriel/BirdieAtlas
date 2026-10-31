import { randomUUID } from 'crypto'
import type { MatchDef } from './bracket.js'

// Todos contra todos (round robin). Funções puras.
//
// Convenção de `round` igual à da eliminação (maior = jogada antes), para o agendador e a fila ao vivo
// continuarem ordenando por fase sem saber o formato: a 1ª rodada jogada tem o maior número e a última
// tem 1. O texto exibido ("Rodada 1", "Rodada 2"...) fica em `roundLabel`.

export function roundRobinRoundLabel(playedOrder: number): string {
  return `Rodada ${playedOrder}`
}

/** Método do círculo: cada inscrição enfrenta todas as outras uma vez. Número ímpar: quem folga não gera partida. */
export function buildRoundRobinMatchDefs(drawId: string, registrationIds: readonly string[]): MatchDef[] {
  const ids: (string | null)[] = [...registrationIds]
  if (ids.length % 2 === 1) ids.push(null)
  const n = ids.length
  const totalRounds = n - 1
  const defs: MatchDef[] = []

  let ring = ids
  for (let r = 0; r < totalRounds; r++) {
    let position = 0
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i] ?? null
      const b = ring[n - 1 - i] ?? null
      if (a === null || b === null) continue
      position++
      defs.push({
        id: randomUUID(),
        drawId,
        round: totalRounds - r,
        position,
        registration1Id: a,
        registration2Id: b,
        nextMatchId: null,
        status: 'pending',
        roundLabel: roundRobinRoundLabel(r + 1),
      })
    }
    // Fixa o primeiro e gira os demais.
    ring = [ring[0] ?? null, ring[n - 1] ?? null, ...ring.slice(1, n - 1)]
  }
  return defs
}

export interface RoundRobinMatch {
  id: string
  registration1Id: string | null
  registration2Id: string | null
}

export interface RoundRobinSet {
  score1: number
  score2: number
}

export interface RoundRobinRow {
  registrationId: string
  played: number
  wins: number
  losses: number
  setsFor: number
  setsAgainst: number
  pointsFor: number
  pointsAgainst: number
}

interface Outcome {
  winner: string
  loser: string
  setsWinner: number
  setsLoser: number
  pointsWinner: number
  pointsLoser: number
}

function outcomeOf(match: RoundRobinMatch, sets: readonly RoundRobinSet[]): Outcome | null {
  const { registration1Id: r1, registration2Id: r2 } = match
  if (!r1 || !r2 || sets.length === 0) return null
  const w1 = sets.filter((s) => s.score1 > s.score2).length
  const w2 = sets.filter((s) => s.score2 > s.score1).length
  if (w1 === w2) return null
  const p1 = sets.reduce((sum, s) => sum + s.score1, 0)
  const p2 = sets.reduce((sum, s) => sum + s.score2, 0)
  return w1 > w2
    ? { winner: r1, loser: r2, setsWinner: w1, setsLoser: w2, pointsWinner: p1, pointsLoser: p2 }
    : { winner: r2, loser: r1, setsWinner: w2, setsLoser: w1, pointsWinner: p2, pointsLoser: p1 }
}

/**
 * Classificação do todos contra todos. Desempate entre inscrições com as mesmas vitórias, nesta ordem:
 * vitórias no confronto entre as empatadas (com duas, é o confronto direto), saldo de sets, saldo de
 * pontos e, por fim, o id (só para a ordem ser estável).
 */
export function computeRoundRobinStandings(
  registrationIds: readonly string[],
  matches: readonly RoundRobinMatch[],
  setsByMatchId: ReadonlyMap<string, readonly RoundRobinSet[]>,
): RoundRobinRow[] {
  const rows = new Map<string, RoundRobinRow>(
    registrationIds.map((id) => [
      id,
      { registrationId: id, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0 },
    ]),
  )
  const outcomes: Outcome[] = []
  for (const match of matches) {
    const outcome = outcomeOf(match, setsByMatchId.get(match.id) ?? [])
    if (!outcome) continue
    outcomes.push(outcome)
    const w = rows.get(outcome.winner)
    const l = rows.get(outcome.loser)
    if (w) {
      w.played++
      w.wins++
      w.setsFor += outcome.setsWinner
      w.setsAgainst += outcome.setsLoser
      w.pointsFor += outcome.pointsWinner
      w.pointsAgainst += outcome.pointsLoser
    }
    if (l) {
      l.played++
      l.losses++
      l.setsFor += outcome.setsLoser
      l.setsAgainst += outcome.setsWinner
      l.pointsFor += outcome.pointsLoser
      l.pointsAgainst += outcome.pointsWinner
    }
  }

  const byWins = [...rows.values()].sort((a, b) => b.wins - a.wins || a.registrationId.localeCompare(b.registrationId))
  const ordered: RoundRobinRow[] = []
  for (let i = 0; i < byWins.length; ) {
    let j = i
    while (j < byWins.length && byWins[j]!.wins === byWins[i]!.wins) j++
    const group = byWins.slice(i, j)
    if (group.length > 1) {
      const inGroup = new Set(group.map((r) => r.registrationId))
      const miniWins = new Map<string, number>(group.map((r) => [r.registrationId, 0]))
      for (const o of outcomes) {
        if (inGroup.has(o.winner) && inGroup.has(o.loser)) miniWins.set(o.winner, (miniWins.get(o.winner) ?? 0) + 1)
      }
      group.sort(
        (a, b) =>
          (miniWins.get(b.registrationId) ?? 0) - (miniWins.get(a.registrationId) ?? 0) ||
          b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
          b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
          a.registrationId.localeCompare(b.registrationId),
      )
    }
    ordered.push(...group)
    i = j
  }
  return ordered
}

/** Colocação final = posição na classificação (1º, 2º, 3º...). */
export function computeRoundRobinPlacements(
  matches: readonly RoundRobinMatch[],
  setsByMatchId: ReadonlyMap<string, readonly RoundRobinSet[]>,
): Map<string, number> {
  const ids = [...new Set(matches.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((v): v is string => v !== null))]
  const placements = new Map<string, number>()
  computeRoundRobinStandings(ids, matches, setsByMatchId).forEach((row, i) => placements.set(row.registrationId, i + 1))
  return placements
}
