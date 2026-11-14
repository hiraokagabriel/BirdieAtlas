import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ApiError, apiFetch } from '@/lib/api'
import { formatTvTime, tvUpcoming, type QueueMatch } from '@/lib/live'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { PrintButton } from '@/components/shared/print-button'

// Súmulas para imprimir: uma por partida pronta para começar (os dois lados definidos), por horário.
// Para quadras sem operador com celular: a mesa anota o placar no papel e lança depois no diálogo de resultado.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

const loadTournament = cache(async (slug: string): Promise<{ id: string; name: string } | 'error'> => {
  try {
    return await apiFetch<{ id: string; name: string }>(`/tournaments/by-slug/${encodeURIComponent(slug)}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    return 'error'
  }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const tournament = await loadTournament(slug)
  return { title: tournament === 'error' ? 'Súmulas · BirdieAtlas' : `Súmulas · ${tournament.name} · BirdieAtlas` }
}

const SETS = [1, 2, 3] as const

function Scoresheet({ match, tournamentName }: { match: QueueMatch; tournamentName: string }) {
  const where = [match.courtNumber != null ? `Quadra ${match.courtNumber}` : 'Quadra ____', formatTvTime(match.scheduledAt) || 'Horário ____'].join(' · ')
  return (
    <article aria-label={`Súmula: ${match.participant1} x ${match.participant2}`} className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <div>
          <p className="text-xs text-muted-foreground">{tournamentName}</p>
          <h2 className="text-base font-semibold">{match.categoryName} · {match.roundLabel}</h2>
        </div>
        <p className="text-sm font-medium">{where}</p>
      </header>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Placar por set de {match.participant1} contra {match.participant2}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-1/2 border border-border px-2 py-1 text-left font-medium">Lado</th>
            {SETS.map((n) => (
              <th key={n} scope="col" className="border border-border px-2 py-1 font-medium">Set {n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[match.participant1, match.participant2].map((name) => (
            <tr key={name}>
              <th scope="row" className="border border-border px-2 py-3 text-left font-semibold">{name}</th>
              {SETS.map((n) => (
                <td key={n} className="h-12 border border-border" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-x-6 gap-y-3 pt-2 text-sm sm:grid-cols-3">
        <p>Vencedor: <span className="inline-block w-32 border-b border-foreground" /></p>
        <p>Árbitro: <span className="inline-block w-32 border-b border-foreground" /></p>
        <p>Mesa: <span className="inline-block w-32 border-b border-foreground" /></p>
      </div>
    </article>
  )
}

export default async function ScoresheetsPage({ params }: PageProps) {
  const { slug } = await params
  const tournament = await loadTournament(slug)
  if (tournament === 'error') return <ErrorNotice>Não foi possível carregar o torneio. Tente de novo em instantes.</ErrorNotice>

  let queue: QueueMatch[] | null = null
  try {
    queue = tvUpcoming(await apiFetch<QueueMatch[]>(`/tournaments/${tournament.id}/live/queue`), Number.POSITIVE_INFINITY)
  } catch {
    queue = null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Súmulas · {tournament.name}</h1>
          <p className="text-sm text-muted-foreground">Uma por partida pronta para começar, por horário. A mesa anota e depois lança o resultado.</p>
        </div>
        {queue && queue.length > 0 && <PrintButton />}
      </div>
      {queue === null ? (
        <ErrorNotice>Não foi possível carregar as partidas. Tente de novo em instantes.</ErrorNotice>
      ) : queue.length === 0 ? (
        <EmptyNotice>Nenhuma partida pronta para começar (as duas vagas definidas) neste torneio.</EmptyNotice>
      ) : (
        <ol className="space-y-6">
          {queue.map((match) => (
            <li key={match.matchId} className="print-avoid-break rounded-xl border border-border bg-card p-4 print:rounded-none print:border-x-0 print:border-t-0 print:p-0 print:pb-6">
              <Scoresheet match={match} tournamentName={tournament.name} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
