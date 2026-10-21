import { cache } from 'react'
import { unstable_rethrow } from 'next/navigation'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import type { Loaded, TournamentSummary } from '@/lib/home-data'

// Leituras públicas do portal. Todas rodam no servidor e devolvem `{ ok: false }` em vez de lançar,
// para cada bloco da home falhar sozinho sem derrubar a página.

async function safe<T>(run: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (err) {
    unstable_rethrow(err)
    return { ok: false }
  }
}

/** Um único fetch por requisição, compartilhado pelos blocos "próximos" e "recentes". */
export const loadTournaments = cache(() =>
  // public=true: a API já esconde rascunhos. 100 é o máximo por página.
  safe(async () => (await apiFetch<Paginated<TournamentSummary>>('/tournaments?public=true&pageSize=100')).data),
)

export interface PublicClub {
  id: string
  name: string
  slug: string
  city: string | null
  state: string | null
}

export const loadClubs = cache(() =>
  safe(async () => (await apiFetch<Paginated<PublicClub>>('/clubs?pageSize=100')).data),
)

export interface AthleteSearchHit {
  id: string
  name: string
  clubName: string | null
  clubSlug: string | null
}

/** Busca pública por nome (mín. 2 caracteres); a API devolve só campos públicos. */
export const loadAthleteSearch = cache((query: string, limit: number) =>
  safe(
    async () =>
      (await apiFetch<Paginated<AthleteSearchHit>>(`/athletes/search?q=${encodeURIComponent(query)}&pageSize=${limit}`)).data,
  ),
)

interface TenantDto {
  id: string
  name: string
  slug: string
}

interface RankingDto {
  id: string
  name: string
  discipline: string
  year: number
}

interface EntryDto {
  id: string
  position: number
  totalPoints: number
  athleteId: string
  athlete2Id: string | null
  athlete: { id: string; name: string } | null
  athlete2: { id: string; name: string } | null
}

export interface BoardEntry {
  id: string
  position: number
  totalPoints: number
  athleteId: string
  athleteName: string
  athlete2Id: string | null
  athlete2Name: string | null
}

export interface RankingBoard {
  id: string
  name: string
  discipline: string
  year: number
  tenantSlug: string
  tenantName: string
  /** `null` quando só as entradas deste ranking falharam. */
  entries: BoardEntry[] | null
}

function toBoardEntry(e: EntryDto): BoardEntry {
  return {
    id: e.id,
    position: e.position,
    totalPoints: e.totalPoints,
    athleteId: e.athleteId,
    athleteName: e.athlete?.name ?? '—',
    athlete2Id: e.athlete2Id,
    athlete2Name: e.athlete2?.name ?? null,
  }
}

async function loadBoardsUncached(pageSize: number): Promise<RankingBoard[]> {
  const tenants = (await apiFetch<Paginated<TenantDto>>('/tenants?pageSize=100')).data
  const perTenant = await Promise.all(
    tenants.map(async (tenant) => {
      // Com tenantSlug a API devolve só rankings ativos e públicos.
      const rankings = (
        await apiFetch<Paginated<RankingDto>>(`/rankings?tenantSlug=${encodeURIComponent(tenant.slug)}&pageSize=100`)
      ).data
      return Promise.all(
        rankings.map(async (ranking): Promise<RankingBoard> => {
          const base = {
            id: ranking.id,
            name: ranking.name,
            discipline: ranking.discipline,
            year: ranking.year,
            tenantSlug: tenant.slug,
            tenantName: tenant.name,
          }
          try {
            const res = await apiFetch<Paginated<EntryDto>>(`/rankings/${ranking.id}/entries?page=1&pageSize=${pageSize}`)
            return { ...base, entries: res.data.map(toBoardEntry) }
          } catch (err) {
            unstable_rethrow(err)
            return { ...base, entries: null }
          }
        }),
      )
    }),
  )
  return perTenant.flat()
}

/** Rankings públicos e ativos de todas as federações, cada um com as primeiras `pageSize` posições. */
export const loadRankingBoards = cache((pageSize: number) => safe(() => loadBoardsUncached(pageSize)))
