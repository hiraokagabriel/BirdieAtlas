'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorNotice } from '@/components/public/notices'
import { STAT_GRID, StatTile } from '@/components/public/stat-tile'

type Stats = {
  totalAthletes: number
  totalClubs: number
  activeCategories: number
  matchesPlayed: number
  matchesPending: number
}

/** Faixa de números do painel: uma superfície com divisórias, sem cartões nem ícones coloridos (docs/DESIGN.md). */
export function StatsCards() {
  const { data: stats, isPending, isError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<Stats>('/dashboard/stats'),
  })

  if (isError) return <ErrorNotice>Não foi possível carregar os números do painel. Recarregue a página para tentar de novo.</ErrorNotice>

  if (isPending) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Carregando números do painel…</span>
        <Skeleton className="h-21 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <section aria-labelledby="stats-title">
      <h3 id="stats-title" className="sr-only">Números</h3>
      <dl className={STAT_GRID}>
        <StatTile label="Atletas" value={stats.totalAthletes} hint="ativos e filiados" />
        <StatTile label="Clubes" value={stats.totalClubs} hint="filiados" />
        <StatTile label="Disciplinas em jogo" value={stats.activeCategories} hint="em andamento" />
        <StatTile label="Partidas encerradas" value={stats.matchesPlayed} hint={`${stats.matchesPending} sem resultado`} />
      </dl>
    </section>
  )
}
