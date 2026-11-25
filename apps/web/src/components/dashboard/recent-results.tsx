'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { DisciplineChip } from '@/components/public/discipline-chip'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'

type RecentMatch = {
  matchId: string
  categoryName: string
  discipline: string
  round: number
  roundLabel?: string | null
  winnerName: string
  loserName: string
  score: string
  completedAt: string
}

function roundLabel(round: number): string {
  if (round === 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas'
  return `Rodada ${round}`
}

export function RecentResults() {
  const { data: results, isPending, isError } = useQuery({
    queryKey: ['dashboard', 'recent-matches'],
    queryFn: () => apiFetch<RecentMatch[]>('/dashboard/recent-matches'),
  })

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>Resultados recentes</CardTitle>
        <CardDescription>Últimas partidas encerradas nos torneios em andamento</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {isError ? (
          <div className="p-4">
            <ErrorNotice>Não foi possível carregar os resultados. Recarregue a página para tentar de novo.</ErrorNotice>
          </div>
        ) : isPending ? (
          <div role="status" aria-busy="true" className="space-y-2 p-4">
            <span className="sr-only">Carregando resultados recentes…</span>
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : results.length === 0 ? (
          <div className="p-4">
            <EmptyNotice>Nenhuma partida encerrada ainda. Os resultados aparecem aqui assim que forem lançados.</EmptyNotice>
          </div>
        ) : (
          <Table label="Resultados recentes">
            <TableCaption className="sr-only">Últimas partidas encerradas nos torneios em andamento</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="hidden sm:table-cell">Fase</TableHead>
                <TableHead>Vencedor</TableHead>
                <TableHead>Derrotado</TableHead>
                <TableHead className="text-right">Placar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.matchId}>
                  <TableCell className="hidden sm:table-cell">
                    <DisciplineChip discipline={r.discipline} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{r.roundLabel ?? roundLabel(r.round)}</TableCell>
                  <TableCell className="whitespace-normal font-medium">
                    <DisciplineChip discipline={r.discipline} className="mr-1.5 sm:hidden" />
                    {r.winnerName}
                  </TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{r.loserName}</TableCell>
                  <TableCell className="text-right font-heading text-base font-bold tabular-nums">{r.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
