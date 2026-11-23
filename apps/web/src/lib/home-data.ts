export interface TournamentSummary {
  id: string
  name: string
  slug: string
  status: string
  level: string
  startDate: string
  endDate: string
  city: string | null
  state: string | null
}

const UPCOMING_STATUSES = ['in_progress', 'registration_open', 'registration_closed'] as const

function upcomingRank(status: string): number {
  const index = UPCOMING_STATUSES.findIndex((s) => s === status)
  return index === -1 ? UPCOMING_STATUSES.length : index
}

/** Em andamento primeiro, depois inscrições abertas e encerradas; dentro de cada grupo, a data mais próxima antes. */
export function selectUpcoming(tournaments: readonly TournamentSummary[], limit: number): TournamentSummary[] {
  return tournaments
    .filter((t) => upcomingRank(t.status) < UPCOMING_STATUSES.length)
    .sort((a, b) => upcomingRank(a.status) - upcomingRank(b.status) || a.startDate.localeCompare(b.startDate))
    .slice(0, limit)
}

/** Torneios encerrados, do mais recente para o mais antigo. */
export function selectRecent(tournaments: readonly TournamentSummary[], limit: number): TournamentSummary[] {
  return tournaments
    .filter((t) => t.status === 'completed')
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, limit)
}

export type Loaded<T> = { ok: true; data: T } | { ok: false }

/**
 * Torneios para "Ao vivo agora": os com partida em quadra (ou cujo placar falhou, para mostrar o erro),
 * na ordem da lista, até `limit`. O limite vem depois do filtro: um torneio em intervalo não toma a vaga
 * de outro com jogo.
 */
export function selectLiveBoards<B extends { live: Loaded<readonly unknown[]> }>(boards: readonly B[], limit: number): B[] {
  return boards.filter(({ live }) => !live.ok || live.data.length > 0).slice(0, limit)
}
