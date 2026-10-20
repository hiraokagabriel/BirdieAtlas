import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import {
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

export const metadata: Metadata = {
  title: 'BirdieAtlas · Torneios e rankings de badminton',
  description: 'Acompanhe torneios, resultados, rankings, atletas e clubes de badminton das federações.',
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 80) ?? ''
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const query = firstValue((await searchParams).q)

  return (
    <div className="space-y-12">
      <section aria-labelledby="hero-title" className="rounded-2xl bg-primary px-5 py-8 text-primary-foreground md:px-10 md:py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/80">BirdieAtlas</p>
        <h1 id="hero-title" className="mt-2 max-w-3xl text-4xl leading-none md:text-6xl">
          Todo o badminton das federações num só lugar
        </h1>
        <p className="mt-4 max-w-xl text-base text-primary-foreground/90 md:text-lg">
          Torneios, chaves, resultados e rankings atualizados, com o perfil de cada atleta e clube.
        </p>

        <form action="/" method="get" role="search" className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
          <label htmlFor="home-search" className="sr-only">
            Buscar atletas e clubes
          </label>
          <input
            id="home-search"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={80}
            placeholder="Buscar atleta ou clube"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <Search className="size-4" aria-hidden="true" />
            Buscar
          </button>
        </form>
      </section>

      {query && (
        <Section id="search-title" title={`Resultados para “${query}”`}>
          <Suspense fallback={<SearchSkeleton />}>
            <SearchResults query={query} />
          </Suspense>
        </Section>
      )}

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

      <Section id="rankings-title" title="Top 10 dos rankings">
        <Suspense fallback={<RankingsSkeleton />}>
          <TopRankings />
        </Suspense>
      </Section>
    </div>
  )
}
