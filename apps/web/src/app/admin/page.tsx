import type { Metadata } from 'next'
import Link from 'next/link'
import { Radio } from '@/components/icons/ba'
import { Button } from '@/components/ui/button'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RankingChart } from '@/components/dashboard/ranking-chart'
import { UpcomingMatches } from '@/components/dashboard/upcoming-matches'
import { RecentResults } from '@/components/dashboard/recent-results'
import { CourtsPanel } from '@/components/dashboard/courts-panel'
import { AttentionPanel } from '@/components/dashboard/attention-panel'

export const metadata: Metadata = { title: 'Visão geral · Administração · BirdieAtlas' }

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Regra da Próxima Ação: a ação mais provável (operar a quadra) no primeiro viewport. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl">Visão geral</h2>
          <p className="text-sm text-muted-foreground">Andamento dos torneios em jogo: atletas, partidas e resultados.</p>
        </div>
        <Button asChild>
          <Link href="/admin/live">
            <Radio className="size-4" aria-hidden="true" />
            Abrir o Ao vivo
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0">
        <CourtsPanel />
        <AttentionPanel />
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
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
