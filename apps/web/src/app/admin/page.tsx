import { StatsCards } from '@/components/dashboard/stats-cards'
import { RankingChart } from '@/components/dashboard/ranking-chart'
import { UpcomingMatches } from '@/components/dashboard/upcoming-matches'
import { RecentResults } from '@/components/dashboard/recent-results'

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Visão Geral</h2>
        <p className="text-muted-foreground">Acompanhe o andamento do campeonato em tempo real.</p>
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <RankingChart />
        </div>
        <div className="lg:col-span-2">
          <UpcomingMatches />
        </div>
      </div>

      <RecentResults />
    </div>
  )
}
