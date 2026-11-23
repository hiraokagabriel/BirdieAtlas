import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import {
  LiveNowHome,
  LiveSkeleton,
  RankingsSkeleton,
  RecentTournaments,
  SearchResults,
  SearchSkeleton,
  Section,
  TopRankings,
  TournamentsSkeleton,
  UpcomingTournaments,
} from '@/components/public/home-sections'

// Dados mudam a cada torneio; renderiza por requisição em vez de prerender no build.
export const dynamic = 'force-dynamic'

const DESCRIPTION = 'Acompanhe torneios, resultados, rankings, atletas e clubes de badminton das federações.'

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 80) ?? ''
}

/** Com busca, o título diz o que foi buscado (cada página precisa de um título próprio, WCAG 2.4.2). */
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const query = firstValue((await searchParams).q)
  return {
    title: query ? `Busca por “${query}” · BirdieAtlas` : 'BirdieAtlas · Torneios e rankings de badminton',
    description: DESCRIPTION,
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const query = firstValue((await searchParams).q)

  return (
    <div className="space-y-8">
      <h1 className="sr-only">Torneios, resultados e rankings de badminton</h1>

      {/* Busca no topo: a forma mais curta de chegar a um atleta ou clube (docs/DESIGN.md, A Regra dos Dois Toques). */}
      <form id="busca" action="/" method="get" role="search" className="flex gap-2">
        <label htmlFor="home-search" className="sr-only">
          Buscar atletas e clubes
        </label>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="home-search"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={80}
            placeholder="Buscar atleta ou clube"
            autoComplete="off"
            className="h-11 w-full rounded-md border border-field-border bg-card pr-4 pl-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
        >
          Buscar
        </button>
      </form>

      {query && (
        <Section id="search-title" title={`Resultados para “${query}”`}>
          <Suspense fallback={<SearchSkeleton />}>
            <SearchResults query={query} />
          </Suspense>
        </Section>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] [&>*]:min-w-0">
        <div className="space-y-8">
          <Suspense fallback={<LiveSkeleton />}>
            <LiveNowHome />
          </Suspense>

          <Section id="upcoming-title" title="Próximos torneios">
            <Suspense fallback={<TournamentsSkeleton />}>
              <UpcomingTournaments />
            </Suspense>
          </Section>

          <Section id="recent-title" title="Resultados recentes">
            <Suspense fallback={<TournamentsSkeleton />}>
              <RecentTournaments />
            </Suspense>
          </Section>
        </div>

        <Section id="rankings-title" anchor="ranking" title="Ranking">
          <Suspense fallback={<RankingsSkeleton />}>
            <TopRankings />
          </Suspense>
        </Section>
      </div>
    </div>
  )
}
