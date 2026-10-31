import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronLeft } from 'lucide-react'
import { fetchHeadToHead } from '@/lib/public-athlete'
import { formatDate } from '@/lib/format'
import { EmptyNotice } from '@/components/public/notices'
import { ResultChip, SummaryTiles } from '@/components/public/athlete-stats-section'

// Confronto direto: muda a cada partida encerrada; renderiza por requisição.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ athleteId: string; opponentId: string }> }

async function load(params: PageProps['params']) {
  const { athleteId, opponentId } = await params
  const data = await fetchHeadToHead(athleteId, opponentId)
  if (!data) notFound()
  return data
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { athlete, opponent } = await load(params)
  return { title: `${athlete.name} x ${opponent.name} · BirdieAtlas` }
}

export default async function HeadToHeadPage({ params }: PageProps) {
  const { athlete, opponent, summary, matches } = await load(params)

  return (
    <div className="space-y-8">
      <Link
        href={`/a/${athlete.id}`}
        className="inline-flex min-h-8 items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Voltar para {athlete.name}
      </Link>

      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Confronto direto</p>
        <h1 className="text-3xl md:text-4xl">
          <Link href={`/a/${athlete.id}`} className="hover:underline">{athlete.name}</Link>
          <span className="mx-3 text-muted-foreground">x</span>
          <Link href={`/a/${opponent.id}`} className="hover:underline">{opponent.name}</Link>
        </h1>
      </header>

      {matches.length === 0 ? (
        <EmptyNotice>Estes atletas ainda não se enfrentaram em partidas encerradas.</EmptyNotice>
      ) : (
        <>
          <section aria-labelledby="h2h-summary" className="space-y-3">
            <h2 id="h2h-summary" className="sr-only">Resumo do ponto de vista de {athlete.name}</h2>
            <SummaryTiles summary={summary} />
            <p className="text-sm text-muted-foreground">
              Números do ponto de vista de {athlete.name}. O adversário tem {summary.losses} vitória{summary.losses === 1 ? '' : 's'}.
            </p>
          </section>

          <section aria-labelledby="h2h-matches" className="space-y-3">
            <h2 id="h2h-matches" className="text-2xl">Partidas</h2>
            <ul className="space-y-2">
              {matches.map((m) => (
                <li key={m.matchId} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <ResultChip result={m.result} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      <Link
                        href={`/t/${m.tournamentSlug}`}
                        className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {m.tournamentName}
                      </Link>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.categoryName} · {m.roundLabel} · {formatDate(m.tournamentDate, 'medium')}
                      {m.partners.length > 0 && ` · com ${m.partners.join(' / ')}`}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{m.score}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
