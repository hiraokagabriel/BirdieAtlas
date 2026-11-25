import { ApiError, apiFetch } from '@/lib/api'

// Perfil público de um atleta (GET /athletes/:id/profile). Nunca traz e-mail, CPF, telefone nem data de nascimento.

export interface Athlete {
  id: string
  name: string
  gender: 'M' | 'F'
  nationality: string
  photoUrl: string | null
  active: boolean
}

export interface CurrentClub {
  clubId: string
  clubName: string | null
  clubSlug: string | null
  city: string | null
  state: string | null
}

export interface RankingPosition {
  rankingId: string
  rankingName: string
  discipline: string
  year: number
  position: number | null
  totalPoints: number | null
  partnerId: string | null
  partnerName: string | null
}

export interface TournamentEntry {
  registrationId: string
  seed: number | null
  finalPlacement: number | null
  categoryName: string
  discipline: string
  tournamentId: string
  tournamentName: string
  tournamentSlug: string
  tournamentStatus: string
  startDate: string
  endDate: string
  level: string
  city: string
  state: string
}

export interface ProfileData {
  athlete: Athlete
  currentClub: CurrentClub | null
  rankingPositions: RankingPosition[]
  tournamentHistory: TournamentEntry[]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `null` quando o atleta não existe (id malformado, 400 ou 404); qualquer outra falha sobe. */
export async function fetchAthleteProfile(athleteId: string): Promise<ProfileData | null> {
  if (!UUID_PATTERN.test(athleteId)) return null
  try {
    return await apiFetch<ProfileData>(`/athletes/${encodeURIComponent(athleteId)}/profile`)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null
    throw err
  }
}

// Estatísticas de partidas (GET /athletes/:id/stats) e confronto direto
// (GET /athletes/:id/head-to-head/:opponentId). Públicos, sem dados pessoais.

export interface StatsSummary {
  played: number
  wins: number
  losses: number
  winRate: number
  setsWon: number
  setsLost: number
  pointsFor: number
  pointsAgainst: number
}

export interface RecentMatch {
  matchId: string
  result: 'W' | 'L' | null
  score: string
  tournamentName: string
  tournamentSlug: string
  categoryName: string
  roundLabel: string
  opponents: { id: string; name: string }[]
}

export interface AthleteStats {
  summary: StatsSummary
  longestWinStreak: number
  titles: number
  finals: number
  podiums: number
  recent: RecentMatch[]
}

export interface HeadToHeadMatch {
  matchId: string
  result: 'W' | 'L' | null
  score: string
  tournamentName: string
  tournamentSlug: string
  tournamentDate: string
  categoryName: string
  roundLabel: string
  partners: string[]
}

export interface HeadToHead {
  athlete: { id: string; name: string }
  opponent: { id: string; name: string }
  summary: StatsSummary
  matches: HeadToHeadMatch[]
}

/** `null` se a API falhar: o perfil continua útil sem as estatísticas. */
export async function fetchAthleteStats(athleteId: string): Promise<AthleteStats | null> {
  if (!UUID_PATTERN.test(athleteId)) return null
  try {
    return await apiFetch<AthleteStats>(`/athletes/${encodeURIComponent(athleteId)}/stats`)
  } catch {
    return null
  }
}

export type UpcomingMatch = {
  tournament: { id: string; name: string; slug: string }
  next: {
    matchId: string; categoryName: string; roundLabel: string; kind: 'live' | 'upcoming'
    opponent: string | null; opponentKnown: boolean; courtNumber: number | null; scheduledAt: string | null
  }
  /** Partidas ainda a jogar no torneio (inclui a próxima). */
  remaining: number
}

/** Próxima partida em cada torneio em andamento. Falha da API vira lista vazia: o bloco só some do perfil. */
export async function fetchAthleteUpcoming(athleteId: string): Promise<UpcomingMatch[]> {
  if (!UUID_PATTERN.test(athleteId)) return []
  try {
    return (await apiFetch<{ data: UpcomingMatch[] }>(`/athletes/${encodeURIComponent(athleteId)}/upcoming-matches`)).data
  } catch {
    return []
  }
}

/** `null` quando algum dos atletas não existe ou o par é inválido (mesmo atleta, id malformado). */
export async function fetchHeadToHead(athleteId: string, opponentId: string): Promise<HeadToHead | null> {
  if (!UUID_PATTERN.test(athleteId) || !UUID_PATTERN.test(opponentId)) return null
  try {
    return await apiFetch<HeadToHead>(
      `/athletes/${encodeURIComponent(athleteId)}/head-to-head/${encodeURIComponent(opponentId)}`,
    )
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null
    throw err
  }
}
