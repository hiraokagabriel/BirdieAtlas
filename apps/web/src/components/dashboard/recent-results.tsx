'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'

type RecentMatch = {
  matchId: string
  categoryName: string
  discipline: string
  round: number
  winnerName: string
  loserName: string
  score: string
  completedAt: string
}

const categoryColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/10',
  WS: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/10',
  MD: 'bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/10',
  WD: 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/10',
  XD: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/10',
}

function roundLabel(round: number): string {
  if (round === 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas'
  return `Rodada ${round}`
}

export function RecentResults() {
  const [results, setResults] = useState<RecentMatch[] | null>(null)

  useEffect(() => {
    apiFetch<RecentMatch[]>('/dashboard/recent-matches').then(setResults).catch(() => setResults([]))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultados Recentes</CardTitle>
        <CardDescription>Últimas partidas encerradas no torneio</CardDescription>
      </CardHeader>
      <CardContent>
        {results === null ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma partida encerrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Vencedor</TableHead>
                <TableHead>Derrotado</TableHead>
                <TableHead className="text-right">Placar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.matchId} className="hover:bg-accent/50">
                  <TableCell>
                    <Badge variant="secondary" className={categoryColors[r.discipline]}>
                      {r.discipline}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{roundLabel(r.round)}</TableCell>
                  <TableCell className="font-medium">{r.winnerName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.loserName}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
