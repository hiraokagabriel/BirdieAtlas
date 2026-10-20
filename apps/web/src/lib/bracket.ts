// Regras puras da visualização da chave. Convenção da API: round 1 é a final e o
// maior round é a primeira fase (ver docs/ESPECIFICACAO_COMPLETA.md, seção Chaves).

export type BracketMatch = {
  id: string
  round: number
  position: number
  status: string
  registration1Id: string | null
  registration2Id: string | null
  nextMatchId?: string | null
  scheduledAt?: string | null
  courtNumber?: number | null
}

export type BracketEntry = {
  id: string
  athleteId: string
  athlete2Id: string | null
  seed: number | null
  athleteName: string | null
  athlete2Name: string | null
}

export type SetScore = { matchId: string; setNumber: number; score1: number; score2: number }

export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'walkover' | 'retired'

/** Estados em que a partida já tem resultado definitivo. */
const FINISHED_STATUSES: readonly string[] = ['completed', 'walkover', 'retired']

export function isFinishedStatus(status: string): boolean {
  return FINISHED_STATUSES.includes(status)
}

/** Título da fase a partir do número da rodada (1 = final). */
export function roundTitle(round: number): string {
  if (round <= 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas de final'
  if (round === 4) return 'Oitavas de final'
  // A rodada r tem 2^(r-1) partidas, ou seja, 2^r participantes.
  return `Fase de ${2 ** round}`
}

export type BracketRound = { round: number; title: string; matches: BracketMatch[] }

/** Rodadas da primeira fase até a final, com as partidas ordenadas por posição. */
export function buildRounds(matches: readonly BracketMatch[]): BracketRound[] {
  const byRound = new Map<number, BracketMatch[]>()
  for (const match of matches) {
    const list = byRound.get(match.round)
    if (list) list.push(match)
    else byRound.set(match.round, [match])
  }
  return [...byRound.keys()]
    .sort((a, b) => b - a)
    .map((round) => ({
      round,
      title: roundTitle(round),
      matches: [...(byRound.get(round) ?? [])].sort((a, b) => a.position - b.position),
    }))
}

/** Bye: partida da primeira fase com um único inscrito, já encerrada como walkover. */
export function isByeMatch(match: BracketMatch, maxRound: number): boolean {
  return (
    match.round === maxRound &&
    match.status === 'walkover' &&
    (match.registration1Id === null) !== (match.registration2Id === null)
  )
}

/** Sets da partida em ordem. */
export function setsOf(matchId: string, results: readonly SetScore[]): SetScore[] {
  return results.filter((r) => r.matchId === matchId).sort((a, b) => a.setNumber - b.setNumber)
}

/** Vencedor lido dos sets salvos (nunca presumido pelo slot). */
export function matchWinner(match: BracketMatch, sets: readonly SetScore[]): 1 | 2 | null {
  if (!isFinishedStatus(match.status) || sets.length === 0) return null
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  if (wins1 === wins2) return null
  return wins1 > wins2 ? 1 : 2
}

/** Vencedor efetivo: bye avança o único inscrito, sem sets. */
export function effectiveWinner(match: BracketMatch, sets: readonly SetScore[], bye: boolean): 1 | 2 | null {
  if (bye) return match.registration1Id !== null ? 1 : 2
  return matchWinner(match, sets)
}

export type Podium = { champion: string; runnerUp: string | null }

/** Campeão e vice a partir da final encerrada; `null` enquanto a final não tem vencedor. */
export function computePodium(matches: readonly BracketMatch[], results: readonly SetScore[]): Podium | null {
  const final = matches.find((m) => m.round === 1)
  if (!final) return null
  const maxRound = Math.max(...matches.map((m) => m.round))
  const winner = effectiveWinner(final, setsOf(final.id, results), isByeMatch(final, maxRound))
  if (!winner) return null
  const champion = winner === 1 ? final.registration1Id : final.registration2Id
  if (!champion) return null
  return { champion, runnerUp: winner === 1 ? final.registration2Id : final.registration1Id }
}

export type SlotAthlete = { id: string; name: string }

export type SlotView =
  | { kind: 'athlete'; regId: string; seed: number | null; athletes: SlotAthlete[]; label: string }
  | { kind: 'tbd' }
  | { kind: 'bye' }

export function indexEntries(entries: readonly BracketEntry[]): Map<string, BracketEntry> {
  return new Map(entries.map((e) => [e.id, e]))
}

/** Descreve um slot: atleta/dupla, "a definir" (vencedor ainda não chegou) ou BYE. */
export function describeSlot(regId: string | null, entries: ReadonlyMap<string, BracketEntry>, isBye: boolean): SlotView {
  if (!regId) return isBye ? { kind: 'bye' } : { kind: 'tbd' }
  const entry = entries.get(regId)
  const athletes: SlotAthlete[] = []
  if (entry) {
    athletes.push({ id: entry.athleteId, name: entry.athleteName ?? 'Atleta sem nome' })
    if (entry.athlete2Id) athletes.push({ id: entry.athlete2Id, name: entry.athlete2Name ?? 'Atleta sem nome' })
  }
  if (athletes.length === 0) athletes.push({ id: '', name: 'Participante' })
  return {
    kind: 'athlete',
    regId,
    seed: entry?.seed ?? null,
    athletes,
    label: athletes.map((a) => a.name).join(' / '),
  }
}

export function slotLabel(slot: SlotView): string {
  if (slot.kind === 'athlete') return slot.label
  return slot.kind === 'bye' ? 'BYE' : 'A definir'
}

export type StatusChip = { key: 'scheduled' | 'waiting' | 'live' | 'done' | 'walkover' | 'retired' | 'bye'; label: string }

/** Rótulo do status da partida. `agendada` vale para partida pendente com quadra ou horário. */
export function statusChip(match: BracketMatch, bye: boolean): StatusChip {
  if (bye) return { key: 'bye', label: 'BYE' }
  switch (match.status) {
    case 'in_progress':
      return { key: 'live', label: 'Ao vivo' }
    case 'completed':
      return { key: 'done', label: 'Finalizada' }
    case 'walkover':
      return { key: 'walkover', label: 'W.O.' }
    case 'retired':
      return { key: 'retired', label: 'Desistência' }
    default:
      return match.scheduledAt || match.courtNumber != null
        ? { key: 'scheduled', label: 'Agendada' }
        : { key: 'waiting', label: 'Aguardando' }
  }
}

/** "Quartas de final, partida 2: A contra B, vencedor A". */
export function matchAriaLabel(
  title: string,
  position: number,
  slot1: SlotView,
  slot2: SlotView,
  winner: 1 | 2 | null,
  bye: boolean,
): string {
  const head = `${title}, partida ${position}`
  if (bye) {
    const advancing = slot1.kind === 'athlete' ? slot1 : slot2
    return `${head}: ${slotLabel(advancing)} avança por BYE`
  }
  const spoken = (slot: SlotView) => (slot.kind === 'tbd' ? 'a definir' : slotLabel(slot))
  const base = `${head}: ${spoken(slot1)} contra ${spoken(slot2)}`
  if (winner === null) return base
  return `${base}, vencedor ${slotLabel(winner === 1 ? slot1 : slot2)}`
}

/** "20/10 às 14:30" no fuso do navegador; `null` quando não há horário. */
export function formatMatchTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day} às ${time}`
}
