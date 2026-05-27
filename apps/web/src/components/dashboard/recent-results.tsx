import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const results = [
  {
    id: 1,
    category: 'MS',
    round: 'Semifinal',
    winner: 'Lucas Tanaka',
    loser: 'Bruno Oliveira',
    score: '21-15, 21-18',
  },
  {
    id: 2,
    category: 'MS',
    round: 'Semifinal',
    winner: 'Rafael Souza',
    loser: 'Matheus Lima',
    score: '21-19, 18-21, 21-17',
  },
  {
    id: 3,
    category: 'WS',
    round: 'Semifinal',
    winner: 'Ana Carolina',
    loser: 'Fernanda Costa',
    score: '21-12, 21-16',
  },
  {
    id: 4,
    category: 'WS',
    round: 'Semifinal',
    winner: 'Juliana Ferreira',
    loser: 'Camila Rocha',
    score: '21-17, 14-21, 21-19',
  },
  {
    id: 5,
    category: 'MD',
    round: 'Final',
    winner: 'Lucas / Rafael',
    loser: 'Matheus / Bruno',
    score: '21-14, 19-21, 21-18',
  },
  {
    id: 6,
    category: 'WD',
    round: 'Final',
    winner: 'Ana / Juliana',
    loser: 'Camila / Fernanda',
    score: '21-11, 21-15',
  },
]

const categoryColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/10',
  WS: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/10',
  MD: 'bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/10',
  WD: 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/10',
  XD: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/10',
}

export function RecentResults() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultados Recentes</CardTitle>
        <CardDescription>Últimas partidas encerradas no torneio</CardDescription>
      </CardHeader>
      <CardContent>
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
            {results.map((result) => (
              <TableRow key={result.id} className="hover:bg-accent/50">
                <TableCell>
                  <Badge variant="secondary" className={categoryColors[result.category]}>
                    {result.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{result.round}</TableCell>
                <TableCell className="font-medium">{result.winner}</TableCell>
                <TableCell className="text-muted-foreground">{result.loser}</TableCell>
                <TableCell className="text-right font-mono text-sm">{result.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
