import Link from 'next/link'
import { Calendar, MapPin, TrendingUp } from 'lucide-react'
import { unstable_rethrow } from 'next/navigation'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'

// Dados mudam a cada torneio; renderiza por requisição em vez de prerender no build.
export const dynamic = 'force-dynamic'

interface PublicTournament {
  id: string
  name: string
  slug: string
  status: string
  startDate: string
  endDate: string
  city: string | null
  state: string | null
}

interface PublicTenant {
  id: string
  name: string
  slug: string
}

const STATUS_LABELS: Record<string, string> = {
  registration_open: 'Inscrições abertas',
  registration_closed: 'Inscrições encerradas',
  in_progress: 'Em andamento',
  completed: 'Encerrado',
  cancelled: 'Cancelado',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value))
}

async function loadHome(): Promise<{ tournaments: PublicTournament[]; tenants: PublicTenant[] } | null> {
  try {
    const [tournaments, tenants] = await Promise.all([
      // public=true: a API já esconde rascunhos
      apiFetch<Paginated<PublicTournament>>('/tournaments?public=true&pageSize=20'),
      apiFetch<Paginated<PublicTenant>>('/tenants?pageSize=100'),
    ])
    return { tournaments: tournaments.data, tenants: tenants.data }
  } catch (err) {
    unstable_rethrow(err)
    return null
  }
}

export default async function HomePage() {
  const home = await loadHome()

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Torneios e rankings de badminton</h1>
        <p className="mt-2 text-muted-foreground">
          Acompanhe chaves, resultados e rankings das federações.
        </p>
      </section>

      {home === null ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar os dados agora. Tente novamente em instantes.
        </p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Torneios</h2>
            {home.tournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum torneio publicado ainda.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {home.tournaments.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/t/${t.slug}`}
                      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{STATUS_LABELS[t.status] ?? t.status}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          {formatDate(t.startDate)} – {formatDate(t.endDate)}
                        </span>
                        {(t.city || t.state) && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            {[t.city, t.state].filter(Boolean).join(' / ')}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Rankings</h2>
            {home.tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma federação cadastrada.</p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {home.tenants.map((tenant) => (
                  <li key={tenant.id}>
                    <Link
                      href={`/r/${tenant.slug}`}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      {tenant.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
