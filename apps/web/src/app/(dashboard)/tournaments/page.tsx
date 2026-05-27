import { apiFetch } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, MapPin, Trophy } from 'lucide-react'
import Link from 'next/link'

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

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-600' },
  registration_open: { label: 'Inscrições abertas', className: 'bg-blue-100 text-blue-700' },
  registration_closed: { label: 'Inscrições encerradas', className: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Em andamento', className: 'bg-green-100 text-green-700' },
  completed: { label: 'Encerrado', className: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-600' },
}

export default async function TournamentsPage() {
  const tournaments = await apiFetch<Tournament[]>('/tournaments')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Torneios</h2>
        <p className="text-muted-foreground">Gerencie todos os campeonatos da federação.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tournaments.map((t) => {
          const status = statusConfig[t.status] ?? { label: t.status, className: 'bg-gray-100 text-gray-600' }
          return (
            <Link key={t.id} href={`/tournaments/${t.slug}`}>
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Trophy className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.level}</span>
                    </div>
                    <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base leading-tight">{t.name}</h3>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(t.startDate).toLocaleDateString('pt-BR')} — {new Date(t.endDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {t.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{t.location ? `${t.location}, ` : ''}{t.city}/{t.state}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
