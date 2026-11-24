import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchHeadToHead } from '@/lib/public-athlete'
import { formatDate } from '@/lib/format'
import { BackLink } from '@/components/public/back-link'
import { EmptyNotice } from '@/components/public/notices'
import { INLINE_LINK, ROWS } from '@/components/public/rows'
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
      <header className="space-y-2">
        <BackLink href={`/a/${athlete.id}`}>{athlete.name}</BackLink>
        <h1 className="break-words font-heading text-3xl font-bold leading-tight md:text-4xl">
          <span className="sr-only">Confronto direto: </span>
          <Link href={`/a/${athlete.id}`} className="hover:underline">{athlete.name}</Link>
          <span className="mx-3 text-muted-foreground">x</span>
          <Link href={`/a/${opponent.id}`} className="hover:underline">{opponent.name}</Link>
        </h1>
      </header>

      {matches.length === 0 ? (
        <EmptyNotice>Estes atletas ainda não se enfrentaram em partidas encerradas. O confronto aparece aqui depois da primeira partida entre eles.</EmptyNotice>
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
            <ul className={ROWS}>
              {matches.map((m) => (
                <li key={m.matchId} className="flex min-h-14 items-center gap-3 px-4 pb-3 pt-1">
                  <ResultChip result={m.result} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">
                      <Link href={`/t/${m.tournamentSlug}`} className={`inline-flex min-h-11 items-center ${INLINE_LINK}`}>
                        {m.tournamentName}
                      </Link>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {m.categoryName} · {m.roundLabel} · {formatDate(m.tournamentDate, 'medium')}
                      {m.partners.length > 0 && ` · com ${m.partners.join(' / ')}`}
                    </p>
                  </div>
                  <p className="shrink-0 font-heading text-base font-bold tabular-nums">{m.score}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
