// Histórico de resultados de uma partida (`GET /draws/matches/:matchId/result-history`, admin).

export type ResultSet = { setNumber: number; score1: number; score2: number }

export type ResultEvent = {
  id: string
  matchId: string
  source: 'dialog' | 'live' | 'cascade'
  courtNumber: number | null
  previousStatus: string
  previousSets: ResultSet[]
  nextStatus: string
  nextSets: ResultSet[]
  resetMatchCount: number
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'sem resultado',
  in_progress: 'em andamento',
  completed: 'concluída',
  walkover: 'W.O.',
  retired: 'desistência',
}

function score(sets: readonly ResultSet[], status: string): string {
  const label = STATUS_LABEL[status] ?? status
  if (sets.length === 0) return label
  const text = [...sets].sort((a, b) => a.setNumber - b.setNumber).map((s) => `${s.score1}-${s.score2}`).join(' ')
  return status === 'completed' ? text : `${text} (${label})`
}

export function resultSourceLabel(event: Pick<ResultEvent, 'source' | 'courtNumber'>): string {
  if (event.source === 'dialog') return 'Diálogo de resultado'
  if (event.source === 'cascade') return 'Desfeito: o vencedor de uma partida anterior mudou'
  return event.courtNumber != null ? `Quadra ${event.courtNumber} (ao vivo)` : 'Ao vivo'
}

/** "21-15 21-18" antes e depois, e quantas partidas seguintes a troca de vencedor desfez. */
export function describeResultEvent(event: ResultEvent): { before: string; after: string; cascade: string | null } {
  const n = event.resetMatchCount
  return {
    before: score(event.previousSets, event.previousStatus),
    after: score(event.nextSets, event.nextStatus),
    cascade: n > 0 ? `Desfez ${n} ${n === 1 ? 'partida seguinte' : 'partidas seguintes'}` : null,
  }
}
