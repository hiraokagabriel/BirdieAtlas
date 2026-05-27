import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building2, Trophy, Swords } from 'lucide-react'

const stats = [
  {
    title: 'Atletas Inscritos',
    value: '48',
    description: '+4 esta semana',
    icon: Users,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    title: 'Clubes Participantes',
    value: '12',
    description: '3 federações',
    icon: Building2,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    title: 'Categorias Ativas',
    value: '5',
    description: 'MS · WS · MD · WD · XD',
    icon: Trophy,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
  },
  {
    title: 'Partidas Disputadas',
    value: '34',
    description: '8 aguardando resultado',
    icon: Swords,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
