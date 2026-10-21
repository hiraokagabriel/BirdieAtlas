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
