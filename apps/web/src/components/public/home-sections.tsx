import type { ReactNode } from 'react'
import Link from 'next/link'
import { Building2, MapPin, User } from 'lucide-react'
import { selectRecent, selectUpcoming } from '@/lib/home-data'
import { loadAthleteSearch, loadClubs, loadRankingBoards, loadTournaments } from '@/lib/public-data'
import { matchesQuery } from '@/lib/search'
import { EmptyNotice, ErrorNotice } from './notices'
import { RankingTabs } from './ranking-tabs'
import { TournamentCard } from './tournament-card'

export const TOP_N = 10
const TOURNAMENT_LIMIT = 6
/** Mesmo mínimo que a API exige em `GET /athletes/search`. */
export const SEARCH_MIN_LENGTH = 2
const SEARCH_RESULT_LIMIT = 8

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  )
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  )
}

export function TournamentsSkeleton() {
  return <CardsSkeleton count={3} />
}

export function RankingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-4">
      <div className="h-9 w-64 animate-pulse rounded-full bg-muted" />
      <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  )
}

export function SearchSkeleton() {
  return <div aria-busy="true" aria-label="Buscando" className="h-24 animate-pulse rounded-xl border border-border bg-card" />
}

export async function UpcomingTournaments() {
  const result = await loadTournaments()
  if (!result.ok) return <ErrorNotice>Não foi possível carregar os torneios agora. Tente novamente em instantes.</ErrorNotice>
  const upcoming = selectUpcoming(result.data, TOURNAMENT_LIMIT)
  if (upcoming.length === 0) return <EmptyNotice>Nenhum torneio com inscrições abertas ou em andamento no momento.</EmptyNotice>
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {upcoming.map((t) => (
        <li key={t.id}>
          <TournamentCard tournament={t} />
        </li>
      ))}
    </ul>
  )
}

export async function RecentTournaments() {
  const result = await loadTournaments()
  if (!result.ok) return <ErrorNotice>Não foi possível carregar os resultados agora. Tente novamente em instantes.</ErrorNotice>
  const recent = selectRecent(result.data, TOURNAMENT_LIMIT)
  if (recent.length === 0) return <EmptyNotice>Nenhum torneio encerrado ainda.</EmptyNotice>
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {recent.map((t) => (
        <li key={t.id}>
          <TournamentCard tournament={t} />
        </li>
      ))}
    </ul>
  )
}

export async function TopRankings() {
  const result = await loadRankingBoards(TOP_N)
  if (!result.ok) return <ErrorNotice>Não foi possível carregar os rankings agora. Tente novamente em instantes.</ErrorNotice>
  if (result.data.length === 0) return <EmptyNotice>Nenhum ranking público ativo ainda.</EmptyNotice>
  const tenantCount = new Set(result.data.map((b) => b.tenantSlug)).size
  return <RankingTabs boards={result.data} showTenant={tenantCount > 1} />
}

/** Atletas vêm de `GET /athletes/search` (só campos públicos); clubes são filtrados de `GET /clubs`. */
export async function SearchResults({ query }: { query: string }) {
  if (query.length < SEARCH_MIN_LENGTH) {
    return <EmptyNotice>Digite pelo menos {SEARCH_MIN_LENGTH} letras para buscar.</EmptyNotice>
  }

  const [athletes, clubs] = await Promise.all([loadAthleteSearch(query, SEARCH_RESULT_LIMIT), loadClubs()])

  const athleteHits = athletes.ok ? athletes.data : []
  const clubHits = clubs.ok ? clubs.data.filter((c) => matchesQuery(c.name, query)).slice(0, SEARCH_RESULT_LIMIT) : []

  const failed = !athletes.ok || !clubs.ok
  const empty = athleteHits.length === 0 && clubHits.length === 0

  return (
    <div className="space-y-4">
      {failed && <ErrorNotice>Parte da busca falhou e os resultados podem estar incompletos.</ErrorNotice>}
      {empty && !failed && <EmptyNotice>Nada encontrado para “{query}”. Confira a grafia ou tente outro nome.</EmptyNotice>}
      {athleteHits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg">Atletas</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {athleteHits.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/a/${a.id}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <User className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {a.clubName && <span className="truncate text-xs font-normal text-muted-foreground">{a.clubName}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {clubHits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg">Clubes</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {clubHits.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${c.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {(c.city || c.state) && (
                    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <MapPin className="size-3" aria-hidden="true" />
                      {[c.city, c.state].filter(Boolean).join(' / ')}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
