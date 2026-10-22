'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { DISCIPLINE_PILL } from '@/lib/discipline'

type UpcomingMatch = {
  matchId: string
  categoryName: string
  discipline: string
  round: number
  player1: string
  player2: string
  scheduledAt: string | null
  courtNumber: number | null
  status: 'pending' | 'in_progress'
}

const statusConfig = {
  in_progress: { label: 'Ao vivo', className: 'bg-success hover:bg-success text-background' },
  pending:     { label: 'Aguardando', className: 'bg-muted text-muted-foreground' },
}

function roundLabel(round: number): string {
  if (round === 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas'
  return `Rodada ${round}`
}

export function UpcomingMatches() {
  const [matches, setMatches] = useState<UpcomingMatch[] | null>(null)

  useEffect(() => {
    apiFetch<UpcomingMatch[]>('/dashboard/upcoming-matches').then(setMatches).catch(() => setMatches([]))
  }, [])

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Próximas Partidas</CardTitle>
        <CardDescription>Partidas pendentes e em andamento</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {matches === null ? (
          <div role="status" aria-busy="true" className="space-y-2">
            <span className="sr-only">Carregando próximas partidas…</span>
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma partida pendente.</p>
        ) : (
          matches.map((match) => {
            const status = statusConfig[match.status]
            const time = match.scheduledAt
              ? new Date(match.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : null
            return (
              <div key={match.matchId} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${DISCIPLINE_PILL[match.discipline]}`}>
                      {match.discipline}
                    </span>
                    <span className="text-xs text-muted-foreground">{roundLabel(match.round)}</span>
                  </div>
                  <Badge className={status.className} variant="secondary">
                    {match.status === 'in_progress' && <span aria-hidden="true" className="size-1.5 rounded-full bg-background motion-safe:animate-pulse" />}
                    {status.label}
                  </Badge>
                </div>
                <div className="text-sm font-medium">
                  {match.player1} <span className="text-muted-foreground font-normal">vs</span> {match.player2}
                </div>
                {(time || match.courtNumber) && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{time}</span>}
                    {match.courtNumber && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Quadra {match.courtNumber}</span>}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
