'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const TOURNAMENT_STATUSES = {
  scheduled: 'Agendado',
  ongoing: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
} as const

type TournamentStatus = keyof typeof TOURNAMENT_STATUSES

interface Tournament {
  id: string
  name: string
  slug: string
  level: string
  status: TournamentStatus
  startDate: string
  endDate: string | null
}

interface TournamentsResponse {
  data: Tournament[]
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatPeriod(tournament: Tournament): string {
  const startDate = formatDate(tournament.startDate)

  if (!tournament.endDate) {
    return startDate
  }

  return `${startDate} até ${formatDate(tournament.endDate)}`
}

function getStatusClassName(status: TournamentStatus): string {
  const statusClasses: Record<TournamentStatus, string> = {
    scheduled: 'bg-sky-100 text-sky-800',
    ongoing: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-slate-100 text-slate-800',
    cancelled: 'bg-rose-100 text-rose-800',
  }

  return statusClasses[status]
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTournaments() {
      try {
        const response = await fetch('/api/tournaments')

        if (!response.ok) {
          throw new Error('Não foi possível carregar os torneios.')
        }

        const payload: TournamentsResponse | Tournament[] = await response.json()
        setTournaments(Array.isArray(payload) ? payload : payload.data)
      } catch (caughtError: unknown) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Ocorreu um erro ao carregar os torneios.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadTournaments()
  }, [])

  return (
    <section className="space-y-6 p-6 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Torneios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os campeonatos e acompanhe seus status.
          </p>
        </div>

        <Link
          href="/dashboard/tournaments/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Novo torneio
        </Link>
      </header>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Carregando torneios...
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {!isLoading && !error && tournaments.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <h2 className="text-lg font-semibold">Nenhum torneio cadastrado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie o primeiro torneio para começar a organizar inscrições, categorias e chaves.
          </p>
          <Link
            href="/dashboard/tournaments/new"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Criar torneio
          </Link>
        </div>
      ) : null}

      {!isLoading && !error && tournaments.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Torneio</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((tournament) => (
                <tr key={tournament.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/dashboard/tournaments/${tournament.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {tournament.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{tournament.level}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClassName(tournament.status)}`}
                    >
                      {TOURNAMENT_STATUSES[tournament.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPeriod(tournament)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/tournaments/${tournament.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
