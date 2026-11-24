'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { DisciplineChip } from '@/components/public/discipline-chip'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'

type UpcomingMatch = {
  matchId: string
  categoryName: string
  discipline: string
  round: number
  roundLabel?: string | null
  player1: string
  player2: string
  scheduledAt: string | null
  courtNumber: number | null
  status: 'pending' | 'in_progress'
}

/** Quantas partidas o painel mostra; o resto fica em /admin/live. */
const LIMIT = 6

function roundLabel(round: number): string {
  if (round === 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas'
  return `Rodada ${round}`
}

export function UpcomingMatches() {
  const { data: matches, isPending, isError } = useQuery({
    queryKey: ['dashboard', 'upcoming-matches'],
    queryFn: () => apiFetch<UpcomingMatch[]>('/dashboard/upcoming-matches'),
  })

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>Próximas partidas</CardTitle>
        <CardDescription>Pendentes e em andamento</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {isError ? (
          <div className="p-4">
            <ErrorNotice>Não foi possível carregar as próximas partidas. Recarregue a página para tentar de novo.</ErrorNotice>
          </div>
        ) : isPending ? (
          <div role="status" aria-busy="true" className="space-y-2 p-4">
            <span className="sr-only">Carregando próximas partidas…</span>
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="p-4">
            <EmptyNotice>Nenhuma partida pendente. As partidas aparecem aqui quando um torneio em andamento tiver chave gerada.</EmptyNotice>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {matches.slice(0, LIMIT).map((match) => {
                const time = match.scheduledAt
                  ? new Date(match.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : null
                return (
                  // Linha de partida: horário e quadra à esquerda, categoria e situação, os dois lados embaixo.
                  <li key={match.matchId} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3">
                    <div className="row-span-2">
                      <p className="font-heading text-lg font-bold leading-tight tabular-nums">
                        {time ?? (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Sem horário</span>
                          </>
                        )}
                      </p>
                      {match.courtNumber && <p className="text-xs text-muted-foreground">Quadra {match.courtNumber}</p>}
                    </div>
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <DisciplineChip discipline={match.discipline} />
                      <span className="min-w-0 break-words">{match.roundLabel ?? roundLabel(match.round)}</span>
                    </p>
                    {match.status === 'in_progress' ? (
                      <Badge variant="live" className="justify-self-end">Ao vivo</Badge>
                    ) : (
                      <Badge variant="secondary" className="justify-self-end bg-muted text-muted-foreground">Aguardando</Badge>
                    )}
                    <p className="col-span-2 min-w-0 break-words font-medium leading-snug">
                      {match.player1} <span className="font-normal text-muted-foreground">x</span> {match.player2}
                    </p>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-border px-4 py-1">
              <Link href="/admin/live" className="inline-flex min-h-(--control-h) items-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:underline">
                {matches.length > LIMIT ? `Ver todas (${matches.length}) no Ao vivo` : 'Abrir o Ao vivo'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
