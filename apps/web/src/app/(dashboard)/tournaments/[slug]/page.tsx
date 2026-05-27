import { apiFetch } from '@/lib/api'
import { BracketView } from '@/components/bracket/bracket-view'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin } from 'lucide-react'
import { notFound } from 'next/navigation'

type Tournament = {
  id: string
  name: string
  slug: string
  status: string
  level: string
  startDate: string
  endDate: string
  city: string
  state: string
  location: string
}

type Category = {
  id: string
  name: string
  discipline: string
  drawType: string
  seedCount: number
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tournaments = await apiFetch<Tournament[]>('/tournaments')
  const tournament = tournaments.find((t) => t.slug === slug)
  if (!tournament) notFound()

  const categories = await apiFetch<Category[]>(`/tournaments/${tournament.id}/categories`)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{tournament.name}</h2>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            {tournament.status === 'in_progress' ? 'Em andamento' : tournament.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(tournament.startDate).toLocaleDateString('pt-BR')} — {new Date(tournament.endDate).toLocaleDateString('pt-BR')}
          </span>
          {tournament.city && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {tournament.location}, {tournament.city}/{tournament.state}
            </span>
          )}
        </div>
      </div>

      {/* Bracket com seletor de categoria */}
      <BracketView tournamentId={tournament.id} categories={categories} />
    </div>
  )
}
