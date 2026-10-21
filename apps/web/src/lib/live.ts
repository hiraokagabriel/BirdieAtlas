// Regras puras do placar ao vivo: tipos do contrato da API, reducer dos eventos do stream SSE,
// backoff de reconexão, anúncios para leitores de tela e agrupamento por quadra do operador.
// O contrato está em docs/ESPECIFICACAO_COMPLETA.md (seção Placar ao vivo).

export type Side = 1 | 2

export type LiveSet = { score1: number; score2: number }

/** Partida em andamento, como `GET /tournaments/:id/live/matches` e o stream SSE entregam. */
export type LiveMatch = {
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
  sets: LiveSet[]
  currentSet: { setNumber: number; score1: number; score2: number } | null
  setsWon: { side1: number; side2: number }
  winner: Side | null
  version: number
  updatedAt: string
}

/** Partida pronta para começar (`GET /tournaments/:id/live/queue`). */
export type QueueMatch = {
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

export type LiveEndReason = 'finished' | 'cancelled'

export type LiveEvent =
  | { type: 'snapshot'; matches: LiveMatch[] }
  | { type: 'match'; match: LiveMatch }
  | { type: 'match-ended'; matchId: string; reason: LiveEndReason }

// ---------------------------------------------------------------------------
// Eventos do stream
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLiveMatch(value: unknown): value is LiveMatch {
  return (
    isRecord(value) &&
    typeof value.matchId === 'string' &&
    typeof value.version === 'number' &&
    Array.isArray(value.sets) &&
    isRecord(value.setsWon)
  )
}

/** Valida uma partida ao vivo vinda de fora (ex.: `details.current` de um 409); `null` se o formato não bate. */
export function asLiveMatch(value: unknown): LiveMatch | null {
  return isLiveMatch(value) ? value : null
}

/** Interpreta um evento SSE (`event` + `data` em texto); `null` para evento desconhecido ou malformado. */
export function parseLiveEvent(name: string, data: string): LiveEvent | null {
  let payload: unknown
  try {
    payload = JSON.parse(data)
  } catch {
    return null
  }
  if (!isRecord(payload)) return null

  if (name === 'snapshot') {
    const list = payload.matches
    if (!Array.isArray(list) || !list.every(isLiveMatch)) return null
    return { type: 'snapshot', matches: list }
  }
  if (name === 'match') {
    return isLiveMatch(payload.match) ? { type: 'match', match: payload.match } : null
  }
  if (name === 'match-ended') {
    const { matchId, reason } = payload
    if (typeof matchId !== 'string' || (reason !== 'finished' && reason !== 'cancelled')) return null
    return { type: 'match-ended', matchId, reason }
  }
  return null
}

/** Quadra (sem quadra por último), depois horário e id: ordem estável para a tela. */
export function sortLive(matches: readonly LiveMatch[]): LiveMatch[] {
  return [...matches].sort((a, b) => {
    const courtA = a.courtNumber ?? Number.MAX_SAFE_INTEGER
    const courtB = b.courtNumber ?? Number.MAX_SAFE_INTEGER
    if (courtA !== courtB) return courtA - courtB
    const timeA = a.scheduledAt ?? '9999'
    const timeB = b.scheduledAt ?? '9999'
    if (timeA !== timeB) return timeA < timeB ? -1 : 1
    return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0
  })
}

/**
 * Aplica um evento à lista de partidas ao vivo. Evento mais antigo que o que já temos (versão menor
 * da mesma partida) é ignorado: o snapshot e as atualizações podem se cruzar na reconexão.
 */
export function liveReducer(state: readonly LiveMatch[], event: LiveEvent): LiveMatch[] {
  switch (event.type) {
    case 'snapshot':
      return sortLive(event.matches)
    case 'match': {
      const current = state.find((m) => m.matchId === event.match.matchId)
      if (current && current.version > event.match.version) return [...state]
      return sortLive([...state.filter((m) => m.matchId !== event.match.matchId), event.match])
    }
    case 'match-ended':
      return state.filter((m) => m.matchId !== event.matchId)
  }
}

// ---------------------------------------------------------------------------
// Reconexão
// ---------------------------------------------------------------------------

/** Falhas seguidas de conexão antes de cair para polling. */
export const FALLBACK_AFTER_FAILURES = 4
/** Intervalo do polling de contingência. */
export const POLL_INTERVAL_MS = 5_000
/** De quanto em quanto tempo o polling tenta voltar ao stream. */
export const STREAM_RETRY_FROM_POLLING_MS = 60_000

export type BackoffOptions = { baseMs?: number; maxMs?: number; random?: () => number }

/**
 * Espera antes da tentativa `attempt` (1 = primeira reconexão): exponencial, com teto, e jitter de
 * 50% a 100% do valor para vários clientes não reconectarem juntos.
 */
export function backoffDelay(attempt: number, { baseMs = 1_000, maxMs = 30_000, random = Math.random }: BackoffOptions = {}): number {
  const step = Math.max(0, attempt - 1)
  const ceiling = Math.min(maxMs, baseMs * 2 ** Math.min(step, 20))
  return Math.round(ceiling / 2 + (ceiling / 2) * random())
}

/** Depois de quantas falhas seguidas o stream cede lugar ao polling. */
export function shouldFallBackToPolling(consecutiveFailures: number): boolean {
  return consecutiveFailures >= FALLBACK_AFTER_FAILURES
}

export type LiveConnection = 'connecting' | 'live' | 'reconnecting' | 'polling'

export const CONNECTION_LABEL: Record<LiveConnection, string> = {
  connecting: 'Conectando…',
  live: 'Ao vivo',
  reconnecting: 'Reconectando…',
  polling: 'Atualizando a cada 5 s',
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function liveTitle(match: Pick<LiveMatch, 'participant1' | 'participant2'>): string {
  return `${match.participant1 ?? 'A definir'} x ${match.participant2 ?? 'A definir'}`
}

/** "21-15 · 10-8": sets encerrados e o set em disputa. */
export function formatLiveScore(match: Pick<LiveMatch, 'sets' | 'currentSet'>): string {
  const parts = match.sets.map((s) => `${s.score1}-${s.score2}`)
  if (match.currentSet) parts.push(`${match.currentSet.score1}-${match.currentSet.score2}`)
  return parts.join(' · ')
}

/** Vencedor pelo placar: nome e resultado em sets. */
function winnerSentence(match: LiveMatch): string | null {
  if (!match.winner) return null
  const name = match.winner === 1 ? match.participant1 : match.participant2
  const { side1, side2 } = match.setsWon
  const [won, lost] = match.winner === 1 ? [side1, side2] : [side2, side1]
  return `${name ?? 'Participante'} venceu por ${won} sets a ${lost}`
}

/**
 * Frases para a região aria-live. Só o que importa: início, fim de set, vitória e fim da partida.
 * Pontos soltos não geram anúncio (seria ruído para quem usa leitor de tela).
 */
export function liveAnnouncements(previous: readonly LiveMatch[], next: readonly LiveMatch[]): string[] {
  const before = new Map(previous.map((m) => [m.matchId, m]))
  const after = new Set(next.map((m) => m.matchId))
  const messages: string[] = []

  for (const match of next) {
    const prev = before.get(match.matchId)
    const court = match.courtNumber != null ? ` na quadra ${match.courtNumber}` : ''
    if (!prev) {
      messages.push(`Partida iniciada${court}: ${liveTitle(match)}.`)
      continue
    }
    if (match.winner && !prev.winner) {
      messages.push(`Fim de jogo${court}: ${winnerSentence(match)}. Placar ${formatLiveScore(match)}.`)
    } else if (match.sets.length > prev.sets.length) {
      const last = match.sets[match.sets.length - 1]
      if (last) {
        messages.push(`Fim do set ${match.sets.length}${court}: ${last.score1} a ${last.score2}. ${liveTitle(match)}, sets ${match.setsWon.side1} a ${match.setsWon.side2}.`)
      }
    }
  }
  for (const prev of previous) {
    if (!after.has(prev.matchId)) messages.push(`Partida encerrada: ${liveTitle(prev)}.`)
  }
  return messages
}

// ---------------------------------------------------------------------------
// Operador de quadra
// ---------------------------------------------------------------------------

/** Quadras conhecidas (as das partidas ao vivo e as da fila), em ordem crescente. */
export function knownCourts(live: readonly { courtNumber: number | null }[], queue: readonly { courtNumber: number | null }[]): number[] {
  const courts = new Set<number>()
  for (const m of [...live, ...queue]) if (m.courtNumber != null) courts.add(m.courtNumber)
  return [...courts].sort((a, b) => a - b)
}

/** Partida ao vivo de uma quadra (`null` = partidas sem quadra). */
export function liveOnCourt(live: readonly LiveMatch[], court: number | null): LiveMatch | undefined {
  return live.find((m) => m.courtNumber === court)
}

/** Fila de uma quadra, na ordem recebida (a API já ordena por horário). */
export function queueOnCourt(queue: readonly QueueMatch[], court: number | null): QueueMatch[] {
  return queue.filter((m) => m.courtNumber === court)
}

/** "2 a 1 em sets": resumo do placar de sets para a tela do operador. */
export function setsSummary(match: Pick<LiveMatch, 'setsWon'>): string {
  return `${match.setsWon.side1} x ${match.setsWon.side2} em sets`
}
