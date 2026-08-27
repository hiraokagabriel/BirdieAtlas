import Link from 'next/link';
import { Users, Trophy, Calendar, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { RecentResults } from '@/components/dashboard/recent-results';
import { UpcomingMatches } from '@/components/dashboard/upcoming-matches';
import { RankingChart } from '@/components/dashboard/ranking-chart';

const navItems = [
  {
    title: 'Atletas',
    href: '/dashboard/athletes',
    icon: Users,
    description: 'Gerenciar atletas e duplas',
  },
  {
    title: 'Clubes',
    href: '/dashboard/clubs',
    icon: Users,
    description: 'Gerenciar clubes e afiliaçııes',
  },
  {
    title: 'Torneios',
    href: '/dashboard/tournaments',
    icon: Trophy,
    description: 'Gerenciar torneios e categorias',
  },
  {
    title: 'Rankings',
    href: '/dashboard/rankings',
    icon: Target,
    description: 'Gerenciar rankings e pontuaçııes',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
      </div>

      <StatsCards />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <RecentResults />
        <UpcomingMatches />
      </div>

      <RankingChart />
    </div>
  );
}
