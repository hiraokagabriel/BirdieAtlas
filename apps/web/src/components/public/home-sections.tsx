import type { ReactNode } from 'react'
import Link from 'next/link'
import { Building2, MapPin, User } from 'lucide-react'
import { selectLiveBoards, selectRecent, selectUpcoming } from '@/lib/home-data'
import { disciplineLabel } from '@/lib/labels'
import { sortLive, type LiveMatch } from '@/lib/live'
import { loadAthleteSearch, loadClubs, loadLiveMatches, loadRankingBoards, loadTournaments } from '@/lib/public-data'
import { matchesQuery } from '@/lib/search'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { LiveScoreGrid } from '@/components/live/live-score-grid'
import { EmptyNotice, ErrorNotice } from './notices'
import { RankingTabs } from './ranking-tabs'
import { ROWS, ROW_LINK } from './rows'
import { TournamentRow } from './tournament-card'

export const TOP_N = 10
const TOURNAMENT_LIMIT = 6
/** Quantos torneios em andamento e partidas por torneio a home mostra em "Ao vivo agora". */
const LIVE_TOURNAMENT_LIMIT = 2
const LIVE_MATCH_LIMIT = 4
/** Mesmo mínimo que a API exige em `GET /athletes/search`. */
export const SEARCH_MIN_LENGTH = 2
const SEARCH_RESULT_LIMIT = 8

export function Section({
  id,
  title,
  action,
  anchor,
  children,
}: {
  id: string
  title: string
  action?: ReactNode
  /** Âncora da barra inferior do celular (`/#ao-vivo`, `/#ranking`). */
  anchor?: string
  children: ReactNode
}) {
  return (
    <section id={anchor} aria-labelledby={id} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-2xl">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function RowsSkeleton({ count, rowClass = 'h-16' }: { count: number; rowClass?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando" className={ROWS}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('flex items-center gap-3 px-4', rowClass)}>
          <div className="h-8 w-12 motion-safe:animate-pulse rounded-sm bg-muted" />
          <div className="h-4 flex-1 motion-safe:animate-pulse rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function TournamentsSkeleton() {
  return <RowsSkeleton count={3} />
}

export function LiveSkeleton() {
  return (
    <section aria-label="Ao vivo agora" className="space-y-3">
      <div className="h-8 w-48 motion-safe:animate-pulse rounded-sm bg-muted" />
      <RowsSkeleton count={2} rowClass="h-20" />
    </section>
  )
}

export function RankingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando" className="space-y-3">
      <div className="h-10 w-64 motion-safe:animate-pulse rounded-md bg-muted" />
      <RowsSkeleton count={5} rowClass="h-14" />
    </div>
  )
}

export function SearchSkeleton() {
  return <RowsSkeleton count={2} rowClass="h-12" />
}

export async function UpcomingTournaments() {
  const result = await loadTournaments()
  if (!result.ok) return <ErrorNotice>Não foi possível carregar os torneios agora. Tente novamente em instantes.</ErrorNotice>
  const upcoming = selectUpcoming(result.data, TOURNAMENT_LIMIT)
  if (upcoming.length === 0) return <EmptyNotice>Nenhum torneio com inscrições abertas ou em andamento no momento. Os próximos aparecem aqui assim que forem publicados.</EmptyNotice>
  return (
    <ul className={ROWS}>
      {upcoming.map((t) => (
        <li key={t.id}>
          <TournamentRow tournament={t} />
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
    <ul className={ROWS}>
      {recent.map((t) => (
        <li key={t.id}>
          <TournamentRow tournament={t} />
        </li>
      ))}
    </ul>
  )
}

function setsText(m: LiveMatch, side: 1 | 2): string {
  return m.sets.map((s) => (side === 1 ? `${s.score1} a ${s.score2}` : `${s.score2} a ${s.score1}`)).join(', ')
}

/** Resumo para leitor de tela: a grade visual do placar não tem estrutura (WCAG 1.3.1). */
function liveSummary(m: LiveMatch): string {
  const p1 = m.participant1 ?? 'A definir'
  const p2 = m.participant2 ?? 'A definir'
  const where = m.courtNumber ? `Quadra ${m.courtNumber}, ${disciplineLabel(m.discipline)}` : disciplineLabel(m.discipline)
  const closed = m.sets.length > 0 ? ` Sets: ${setsText(m, 1)}.` : ''
  const current = m.currentSet ? ` Set atual: ${m.currentSet.score1} a ${m.currentSet.score2}.` : ''
  return `${where}: ${p1} contra ${p2}, ${m.setsWon.side1} a ${m.setsWon.side2} em sets.${closed}${current}`
}

function LiveMatchRow({ match: m }: { match: LiveMatch }) {
  return (
    <li className="px-4 py-3">
      <p className="sr-only">{liveSummary(m)}</p>
      <LiveScoreGrid match={m} />
    </li>
  )
}

/**
 * "Ao vivo agora": partidas em quadra dos torneios em andamento (`GET /tournaments/:id/live/matches`).
 * A seção sempre existe, porque a barra inferior aponta para ela (`/#ao-vivo`); sem partida em quadra,
 * diz isso. O placar é o do momento em que a página carregou; o ao vivo com atualização contínua fica na
 * página do torneio, para onde o cabeçalho de cada bloco leva.
 */
export async function LiveNowHome() {
  const tournaments = await loadTournaments()
  const running = tournaments.ok ? tournaments.data.filter((t) => t.status === 'in_progress') : []
  const loaded = await Promise.all(running.map(async (t) => ({ tournament: t, live: await loadLiveMatches(t.id) })))
  const boards = selectLiveBoards(loaded, LIVE_TOURNAMENT_LIMIT)
  return (
    <Section id="live-title" anchor="ao-vivo" title="Ao vivo agora">
      {!tournaments.ok ? (
        <ErrorNotice>Não foi possível carregar os placares agora. Tente novamente em instantes.</ErrorNotice>
      ) : boards.length === 0 ? (
        <EmptyNotice>Nenhuma partida em quadra agora. Quando um torneio estiver em jogo, os placares aparecem aqui.</EmptyNotice>
      ) : (
        <div className="space-y-3">
          {boards.map(({ tournament: t, live }) => (
            <div key={t.id} className={ROWS}>
              <Link href={`/t/${t.slug}`} className={cn('flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3', ROW_LINK)}>
                <Badge variant="live">Ao vivo</Badge>
                <span className="font-semibold">{t.name}</span>
                {live.ok && (
                  <span className="text-xs text-muted-foreground">
                    {live.data.length === 1 ? '1 partida em quadra' : `${live.data.length} partidas em quadra`}
                  </span>
                )}
              </Link>
              {live.ok ? (
                <ul className="divide-y divide-border border-t border-border">
                  {sortLive(live.data).slice(0, LIVE_MATCH_LIMIT).map((m) => (
                    <LiveMatchRow key={m.matchId} match={m} />
                  ))}
                </ul>
              ) : (
                <p role="alert" className="px-4 py-3 text-sm text-destructive">
                  Não foi possível carregar o placar agora. Tente novamente em instantes.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
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
          <ul className={ROWS}>
            {athleteHits.map((a) => (
              <li key={a.id} className="min-w-0">
                <Link href={`/a/${a.id}`} className={cn('flex min-h-12 items-center gap-3 px-4 py-2 font-medium', ROW_LINK)}>
                  <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{a.name}</span>
                    {a.clubName && <span className="block text-xs font-normal text-muted-foreground">{a.clubName}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {clubHits.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg">Clubes</h3>
          <ul className={ROWS}>
            {clubHits.map((c) => (
              <li key={c.id} className="min-w-0">
                <Link href={`/c/${c.slug}`} className={cn('flex min-h-12 items-center gap-3 px-4 py-2 font-medium', ROW_LINK)}>
                  <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{c.name}</span>
                    {(c.city || c.state) && (
                      <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        <MapPin className="size-3" aria-hidden="true" />
                        {[c.city, c.state].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
