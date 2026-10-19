import { randomUUID } from 'crypto'

// Pure single-elimination bracket helpers shared by the draws routes and the seed.
// Rounds count down to the final: round N is the first phase, round 1 is the final.

export type MatchDef = {
  id: string
  drawId: string
  round: number
  position: number
  registration1Id: string | null
  registration2Id: string | null
  nextMatchId: string | null
  status: 'pending' | 'walkover'
}

export function getSlotForPosition(position: number): 'registration1Id' | 'registration2Id' {
  return position % 2 === 1 ? 'registration1Id' : 'registration2Id'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildSlots(
  confirmed: { id: string; seed: number | null }[],
  mode: 'random' | 'seeded',
): (string | null)[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(confirmed.length)))
  const slots: (string | null)[] = new Array(bracketSize).fill(null)

  if (mode === 'random') {
    const shuffled = shuffle(confirmed)
    for (let i = 0; i < shuffled.length; i++) slots[i] = shuffled[i].id
    return slots
  }

  const seeded   = confirmed.filter((r) => r.seed !== null).sort((a, b) => a.seed! - b.seed!)
  const unseeded = shuffle(confirmed.filter((r) => r.seed === null))

  const half    = bracketSize / 2
  const quarter = bracketSize / 4

  const seededPositions: number[] = [
    0,
    bracketSize - 1,
    ...shuffle([half - 1, half]),
    ...shuffle([quarter - 1, quarter, 3 * quarter - 1, 3 * quarter]),
  ]

  for (let i = 0; i < seeded.length && i < seededPositions.length; i++) {
    slots[seededPositions[i]] = seeded[i].id
  }

  let ui = 0
  for (let i = 0; i < bracketSize && ui < unseeded.length; i++) {
    if (slots[i] === null) { slots[i] = unseeded[ui].id; ui++ }
  }

  return slots
}

export function buildMatchDefs(drawId: string, slots: (string | null)[]): MatchDef[] {
  const bracketSize = slots.length
  const numRounds   = Math.log2(bracketSize)

  const matchDefs: MatchDef[] = []

  for (let round = numRounds; round >= 1; round--) {
    const count = Math.pow(2, round - 1)
    for (let pos = 1; pos <= count; pos++) {
      matchDefs.push({ id: randomUUID(), drawId, round, position: pos, registration1Id: null, registration2Id: null, nextMatchId: null, status: 'pending' })
    }
  }

  const firstRoundMatches = matchDefs.filter((m) => m.round === numRounds)
  for (const fm of firstRoundMatches) {
    fm.registration1Id = slots[fm.position - 1] ?? null
    fm.registration2Id = slots[bracketSize - fm.position] ?? null
  }

  for (const match of matchDefs) {
    if (match.round === 1) continue
    const next = matchDefs.find((m) => m.round === match.round - 1 && m.position === Math.ceil(match.position / 2))
    if (next) match.nextMatchId = next.id
  }

  const propagatedMatchIds = new Set<string>()

  const roundsDesc = [...new Set(matchDefs.map((m) => m.round))].sort((a, b) => b - a)
  for (const round of roundsDesc) {
    for (const match of matchDefs.filter((m) => m.round === round)) {
      if (propagatedMatchIds.has(match.id)) continue

      const isBye = match.registration1Id === null || match.registration2Id === null
      const hasAny = match.registration1Id !== null || match.registration2Id !== null
      if (!isBye || !hasAny) continue

      match.status = 'walkover'
      const winnerRegId = match.registration1Id ?? match.registration2Id!

      if (match.nextMatchId) {
        const next = matchDefs.find((m) => m.id === match.nextMatchId)
        if (next) {
          const slot = getSlotForPosition(match.position)
          next[slot] = winnerRegId
          propagatedMatchIds.add(next.id)
        }
      }
    }
  }

  return matchDefs
}
