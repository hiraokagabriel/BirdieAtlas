'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { describeResultEvent, resultSourceLabel, type ResultEvent } from '@/lib/result-history'

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Histórico de gravações do resultado (quem corrigiu o quê e quando, sem identidade de usuário). Recolhido por padrão. */
export function ResultHistory({ matchId, enabled }: { matchId: string; enabled: boolean }) {
  const history = useQuery({
    queryKey: ['result-history', matchId],
    queryFn: () => apiFetch<ResultEvent[]>(`/draws/matches/${matchId}/result-history`),
    enabled,
  })

  return (
    <details className="rounded-lg border border-border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium">
        Histórico de alterações{history.data ? ` (${history.data.length})` : ''}
      </summary>
      <div className="mt-2">
        {history.isPending ? (
          <p role="status" className="text-muted-foreground">Carregando histórico...</p>
        ) : history.isError ? (
          <p role="alert" className="text-destructive">Não foi possível carregar o histórico: {history.error.message}</p>
        ) : history.data.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma alteração registrada (resultados gravados antes do histórico não aparecem).</p>
        ) : (
          <ol className="space-y-2">
            {history.data.map((event) => {
              const { before, after, cascade } = describeResultEvent(event)
              return (
                <li key={event.id} className="space-y-0.5">
                  <p className="font-medium">
                    <time dateTime={event.createdAt}>{dateTime.format(new Date(event.createdAt))}</time> · {resultSourceLabel(event)}
                  </p>
                  <p className="text-muted-foreground">De {before} para <span className="text-foreground">{after}</span></p>
                  {cascade && <p className="text-warning">{cascade}</p>}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </details>
  )
}
