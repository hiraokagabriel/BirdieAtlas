'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building2, Trophy, Swords } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

type Stats = {
  totalAthletes: number
  totalClubs: number
  activeCategories: number
  matchesPlayed: number
  matchesPending: number
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    apiFetch<Stats>('/dashboard/stats').then(setStats).catch(() => null)
  }, [])

  const cards = [
    {
      title: 'Atletas Inscritos',
      value: stats?.totalAthletes ?? null,
      description: 'atletas ativos',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Clubes Participantes',
      value: stats?.totalClubs ?? null,
      description: 'clubes filiados',
      icon: Building2,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Categorias Ativas',
      value: stats?.activeCategories ?? null,
      description: 'MS · WS · MD · WD · XD',
      icon: Trophy,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'Partidas Disputadas',
      value: stats?.matchesPlayed ?? null,
      description: stats ? `${stats.matchesPending} aguardando resultado` : '—',
      icon: Swords,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((stat) => (
        <Card key={stat.title} className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {stat.value === null ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <p className="text-3xl font-bold">{stat.value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
