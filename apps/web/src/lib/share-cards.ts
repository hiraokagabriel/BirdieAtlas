import { TOURNAMENT_LEVEL_LABELS, TOURNAMENT_LEVELS } from '@birdie-atlas/validators'
import { summarizeAthlete, type HistoryEntryLike, type RankingPositionLike } from './athlete-stats'
import { formatDateRange, initials } from './format'
import { disciplineLabel } from './labels'
import { cleanText, joinNames, truncateText } from './share'

// Modelos das imagens de compartilhamento. Todo texto já sai limpo e limitado em tamanho,
// para nenhum nome comprido quebrar o layout; quem desenha só precisa posicionar.

const NAME_MAX = 30
const TITLE_MAX = 64
const CATEGORY_MAX = 34

/** Quantas categorias cabem em cada formato antes do "+N categorias". */
export const PODIUM_CATEGORY_LIMIT = { landscape: 3, portrait: 3 } as const

// ---------------------------------------------------------------------------
// Torneio
// ---------------------------------------------------------------------------
export interface TournamentCardInput {
  tournament: {
    name: string
    status: string
    level: string
    startDate: string
    endDate: string
    city: string | null
    state: string | null
  }
  categories: readonly { id: string; name: string }[]
  stats: { totalCategories: number; totalAthletes: number; totalMatches: number; completedMatches: number }
  /** Inscrições públicas por categoria, com a colocação final (só preenchida em torneio encerrado). */
  registrationsByCategory: ReadonlyMap<string, readonly PlacedRegistration[]>
}

export interface PlacedRegistration {
  athleteName: string | null
  athlete2Name: string | null
  finalPlacement: number | null
}

export interface PodiumCategory {
  name: string
  first: string[]
  second: string[]
  third: string[]
}

export interface TournamentCardModel {
  name: string
  levelLabel: string
  dateRange: string
  place: string
  completed: boolean
  statusLabel: string
  podium: PodiumCategory[]
  stats: { categories: number; athletes: number; matches: number }
}

const STATUS_LABELS: Record<string, string> = {
  registration_open: 'Inscrições abertas',
  registration_closed: 'Inscrições encerradas',
  in_progress: 'Em andamento',
  completed: 'Encerrado',
  cancelled: 'Cancelado',
}

export function levelLabel(level: string): string {
  const known = TOURNAMENT_LEVELS.find((l) => l === level)
  return known ? TOURNAMENT_LEVEL_LABELS[known] : cleanText(level)
}

function namesWithPlacement(regs: readonly PlacedRegistration[], placement: number): string[] {
  return regs
    .filter((r) => r.finalPlacement === placement)
    .map((r) => truncateText(joinNames([r.athleteName, r.athlete2Name]), NAME_MAX))
    .filter(Boolean)
}

export function buildTournamentCard(input: TournamentCardInput): TournamentCardModel {
  const { tournament, categories, stats, registrationsByCategory } = input
  const completed = tournament.status === 'completed'

  // Pódio só existe com o torneio encerrado; categoria sem campeão definido fica de fora.
  const podium: PodiumCategory[] = completed
    ? categories.flatMap((category) => {
        const regs = registrationsByCategory.get(category.id) ?? []
        const first = namesWithPlacement(regs, 1)
        if (first.length === 0) return []
        return [
          {
            name: truncateText(category.name, CATEGORY_MAX),
            first,
            second: namesWithPlacement(regs, 2),
            third: namesWithPlacement(regs, 3),
          },
        ]
      })
    : []

  return {
    name: truncateText(tournament.name, TITLE_MAX),
    levelLabel: levelLabel(tournament.level),
    dateRange: formatDateRange(tournament.startDate, tournament.endDate),
    place: truncateText([tournament.city, tournament.state].filter(Boolean).join(' / '), 40),
    completed,
    statusLabel: STATUS_LABELS[tournament.status] ?? '',
    podium,
    stats: { categories: stats.totalCategories, athletes: stats.totalAthletes, matches: stats.totalMatches },
  }
}

/** Campeão para o texto de compartilhamento: só quando há uma única categoria com pódio. */
export function singleChampion(podium: readonly PodiumCategory[]): string {
  return podium.length === 1 ? (podium[0]?.first.join(' / ') ?? '') : ''
}

// ---------------------------------------------------------------------------
// Atleta
// ---------------------------------------------------------------------------
export interface AthleteCardInput {
  athlete: { name: string }
  currentClub: { clubName: string | null; city: string | null; state: string | null } | null
  rankingPositions: readonly (RankingPositionLike & { rankingName: string; discipline: string })[]
  tournamentHistory: readonly HistoryEntryLike[]
}

export interface AthleteCardModel {
  name: string
  initials: string
  clubName: string
  place: string
  tournaments: number
  titles: number
  podiums: number
  bestPosition: number | null
  bestRankingName: string
}

export function buildAthleteCard(input: AthleteCardInput): AthleteCardModel {
  const summary = summarizeAthlete(input.tournamentHistory, input.rankingPositions)
  const best = input.rankingPositions
    .filter((r) => r.position !== null)
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))[0]
  const name = truncateText(input.athlete.name, TITLE_MAX)
  const club = input.currentClub
  return {
    name,
    initials: initials(name),
    clubName: truncateText(club?.clubName, 44),
    place: truncateText([club?.city, club?.state].filter(Boolean).join(' / '), 30),
    tournaments: summary.tournaments,
    titles: summary.titles,
    podiums: summary.podiums,
    bestPosition: summary.bestRankingPosition,
    bestRankingName: best ? truncateText(`${best.rankingName} · ${disciplineLabel(best.discipline)}`, 52) : '',
  }
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------
export interface RankingCardInput {
  name: string
  discipline: string
  year: number
  tenantName: string
  entries: readonly {
    position: number
    totalPoints: number
    athleteName: string
    athlete2Name: string | null
  }[]
}

export interface RankingCardRow {
  position: number
  name: string
  points: string
}

export interface RankingCardModel {
  title: string
  disciplineLabel: string
  year: number
  federation: string
  rows: RankingCardRow[]
}

export const RANKING_CARD_ROWS = 10

export function buildRankingCard(input: RankingCardInput): RankingCardModel {
  return {
    title: truncateText(input.name, TITLE_MAX),
    disciplineLabel: disciplineLabel(input.discipline),
    year: input.year,
    federation: truncateText(input.tenantName, 48),
    rows: input.entries.slice(0, RANKING_CARD_ROWS).map((e) => ({
      position: e.position,
      name: truncateText(joinNames([e.athleteName, e.athlete2Name]), 38),
      points: e.totalPoints.toLocaleString('pt-BR'),
    })),
  }
}
