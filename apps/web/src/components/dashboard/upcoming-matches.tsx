import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'

const matches = [
  {
    id: 1,
    category: 'MS',
    round: 'Final',
    player1: 'Lucas Tanaka',
    player2: 'Rafael Souza',
    time: '14:00',
    court: 'Quadra 1',
    status: 'in_progress',
  },
  {
    id: 2,
    category: 'WS',
    round: 'Final',
    player1: 'Ana Carolina',
    player2: 'Juliana Ferreira',
    time: '15:30',
    court: 'Quadra 2',
    status: 'pending',
  },
  {
    id: 3,
    category: 'XD',
    round: 'Final',
    player1: 'Lucas / Ana',
    player2: 'Rafael / Juliana',
    time: '17:00',
    court: 'Quadra 1',
    status: 'pending',
  },
]

const statusConfig = {
  in_progress: { label: 'Ao vivo', className: 'bg-green-500 hover:bg-green-500 text-white animate-pulse' },
  pending: { label: 'Aguardando', className: 'bg-muted text-muted-foreground' },
}

const categoryColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-600',
  WS: 'bg-purple-500/10 text-purple-600',
  MD: 'bg-cyan-500/10 text-cyan-600',
  WD: 'bg-pink-500/10 text-pink-600',
  XD: 'bg-orange-500/10 text-orange-600',
}

export function UpcomingMatches() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Próximas Partidas</CardTitle>
        <CardDescription>Hoje · Ginásio do Ibirapuera</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {matches.map((match) => {
          const status = statusConfig[match.status as keyof typeof statusConfig]
          return (
            <div key={match.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${categoryColors[match.category]}`}>
                    {match.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{match.round}</span>
                </div>
                <Badge className={status.className} variant="secondary">{status.label}</Badge>
              </div>
              <div className="text-sm font-medium">
                {match.player1} <span className="text-muted-foreground font-normal">vs</span> {match.player2}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{match.time}</span>
                <span>{match.court}</span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
