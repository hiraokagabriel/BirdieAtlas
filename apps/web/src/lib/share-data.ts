import { cache } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { ApiError, apiFetch } from '@/lib/api'
import { fetchAthleteProfile } from '@/lib/public-athlete'
import { loadRankingBoards, type RankingBoard } from '@/lib/public-data'
import {
  buildAthleteCard,
  buildRankingCard,
  buildTournamentCard,
  singleChampion,
  type AthleteCardModel,
  type PlacedRegistration,
  type RankingCardModel,
  type TournamentCardModel,
} from '@/lib/share-cards'
import { buildShareText, rankingDisplayName, truncateText } from '@/lib/share'

// Leituras públicas e do lado do servidor que alimentam as imagens de compartilhamento e os
// metadados (og/twitter) das páginas. Só endpoints públicos: nada de e-mail, CPF, telefone ou nascimento.

/** `not_found` vira imagem de fallback com 404; `error` (API fora do ar) vira fallback com 200 sem cache. */
export type ShareLoad<T> = { status: 'ok'; card: T; title: string; description: string } | { status: 'not_found' } | { status: 'error' }

function failure(err: unknown): { status: 'not_found' } | { status: 'error' } {
  unstable_rethrow(err)
  if (err instanceof ApiError && err.status === 404) return { status: 'not_found' }
  console.error('[share] falha ao carregar dados da imagem de compartilhamento:', err)
  return { status: 'error' }
}

// ---------------------------------------------------------------------------
// Torneio
// ---------------------------------------------------------------------------
interface TournamentDto {
  id: string
  name: string
  status: string
  level: string
  startDate: string
  endDate: string
  city: string | null
  state: string | null
}

interface PublicSummaryDto {
  tournament: TournamentDto
  categories: { id: string; name: string }[]
  stats: { totalCategories: number; totalAthletes: number; totalMatches: number; completedMatches: number }
}

interface CategoryRegistrationDto extends PlacedRegistration {
  id: string
}

export const loadTournamentShare = cache(async (slug: string): Promise<ShareLoad<TournamentCardModel>> => {
  try {
    const tournament = await apiFetch<TournamentDto>(`/tournaments/by-slug/${encodeURIComponent(slug)}`)
    // Rascunho não é público: nem a imagem nem os metadados revelam que ele existe.
    if (tournament.status === 'draft') return { status: 'not_found' }
    const summary = await apiFetch<PublicSummaryDto>(`/tournaments/${encodeURIComponent(tournament.id)}/public-summary`)

    // A colocação final só existe com o torneio encerrado.
    const registrationsByCategory = new Map<string, readonly PlacedRegistration[]>()
    if (summary.tournament.status === 'completed') {
      await Promise.all(
        summary.categories.map(async (category) => {
          const regs = await apiFetch<CategoryRegistrationDto[]>(`/tournaments/categories/${category.id}/registrations`)
          registrationsByCategory.set(category.id, regs)
        }),
      )
    }

    const card = buildTournamentCard({ ...summary, registrationsByCategory })
    return {
      status: 'ok',
      card,
      title: `${card.name} · BirdieAtlas`,
      description: buildShareText({ kind: 'tournament', name: card.name, champion: singleChampion(card.podium) }),
    }
  } catch (err) {
    return failure(err)
  }
})

// ---------------------------------------------------------------------------
// Atleta
// ---------------------------------------------------------------------------
export const loadAthleteShare = cache(async (athleteId: string): Promise<ShareLoad<AthleteCardModel>> => {
  try {
    const profile = await fetchAthleteProfile(athleteId)
    if (!profile) return { status: 'not_found' }
    const card = buildAthleteCard(profile)
    return {
      status: 'ok',
      card,
      title: `${card.name} · BirdieAtlas`,
      description: buildShareText({ kind: 'athlete', name: card.name }),
    }
  } catch (err) {
    return failure(err)
  }
})

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------
/** Ranking pedido por id; sem id (ou id desconhecido), o primeiro ranking público da federação. */
export function pickBoard(boards: readonly RankingBoard[], tenantSlug: string, rankingId: string | null): RankingBoard | null {
  const ofTenant = boards.filter((b) => b.tenantSlug === tenantSlug)
  return ofTenant.find((b) => b.id === rankingId) ?? ofTenant[0] ?? null
}

export const loadRankingShare = cache(async (tenantSlug: string, rankingId: string | null): Promise<ShareLoad<RankingCardModel>> => {
  const boards = await loadRankingBoards(10)
  if (!boards.ok) return { status: 'error' }
  const board = pickBoard(boards.data, tenantSlug, rankingId)
  if (!board) return { status: 'not_found' }
  if (!board.entries) return { status: 'error' }

  const card = buildRankingCard({ ...board, entries: board.entries })
  const title = truncateText(rankingDisplayName(board.name, card.year), 80)
  return {
    status: 'ok',
    card,
    title: `${title} · BirdieAtlas`,
    description: buildShareText({ kind: 'ranking', name: `${title} (${card.federation})` }),
  }
})
