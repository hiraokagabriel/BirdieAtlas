import { randomUUID } from 'node:crypto'
import { api } from './api.js'

// Dados dos testes: criados pela API (a interface só é exercitada onde ela é o objeto do teste).
// Todo nome e slug leva um sufixo único por chamada, então specs paralelos e execuções repetidas não colidem.

export type Gender = 'M' | 'F'
export type Discipline = 'MS' | 'WS' | 'MD' | 'WD' | 'XD'
export type TournamentLevel = 'local' | 'regional' | 'state' | 'national' | 'international'
export type TournamentStatus =
  | 'draft'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface Athlete {
  id: string
  name: string
  gender: Gender
}
export interface Club {
  id: string
  name: string
  slug: string
}
export interface Tournament {
  id: string
  name: string
  slug: string
  status: TournamentStatus
  level: TournamentLevel
  startDate: string
  endDate: string
  pointsAwarded: boolean
}
export interface Category {
  id: string
  name: string
  discipline: Discipline
  tournamentId: string
}
export interface Registration {
  id: string
  athleteId: string
  athleteName: string | null
  status: string
}
export interface Draw {
  id: string
  categoryId: string
  published: boolean
}
export interface Match {
  id: string
  drawId: string
  round: number
  position: number
  status: string
  registration1Id: string | null
  registration2Id: string | null
  nextMatchId: string | null
  scheduledAt: string | null
  courtNumber: number | null
}
export interface Ranking {
  id: string
  name: string
  slug: string
  discipline: Discipline
  year: number
}

export function uniqueTag(): string {
  return randomUUID().replace(/-/g, '').slice(0, 6)
}

/** Nomes com acento de propósito: a busca pública precisa ignorar acentos e caixa. */
const GIVEN_NAMES: Record<Gender, string[]> = {
  M: ['José', 'João', 'André', 'Hélio', 'Lucas', 'Álvaro', 'Rubens', 'Cauã'],
  F: ['Ana', 'Lúcia', 'Mônica', 'Bia', 'Érica', 'Júlia', 'Íris', 'Aline'],
}

export async function createAthlete(
  options: { name?: string; gender?: Gender; email?: string; birthDate?: string } = {},
): Promise<Athlete> {
  const gender = options.gender ?? 'M'
  const given = GIVEN_NAMES[gender][Math.floor(Math.random() * 8)] ?? 'Ana'
  const name = options.name ?? `${given} Teste ${uniqueTag()}`
  const athlete = await api.post<{ id: string }>('/athletes', {
    name,
    gender,
    nationality: 'BR',
    ...(options.email ? { email: options.email } : {}),
    ...(options.birthDate ? { birthDate: options.birthDate } : {}),
  })
  return { id: athlete.id, name, gender }
}

/** Atletas com nomes ordenáveis e únicos (`Prefixo 01 tag`, `Prefixo 02 tag`...). */
export async function createAthletes(
  count: number,
  options: { gender?: Gender; prefix?: string } = {},
): Promise<Athlete[]> {
  const tag = uniqueTag()
  const prefix = options.prefix ?? 'Atleta'
  const created: Athlete[] = []
  for (let i = 1; i <= count; i++) {
    created.push(
      await createAthlete({
        name: `${prefix} ${String(i).padStart(2, '0')} ${tag}`,
        ...(options.gender ? { gender: options.gender } : {}),
      }),
    )
  }
  return created
}

export async function createClub(options: { name?: string } = {}): Promise<Club> {
  const tag = uniqueTag()
  const name = options.name ?? `Clube Teste ${tag}`
  const club = await api.post<{ id: string; slug: string }>('/clubs', {
    name,
    slug: `clube-teste-${tag}`,
    city: 'São Paulo',
    state: 'SP',
  })
  return { id: club.id, name, slug: club.slug }
}

export async function affiliate(athleteId: string, clubId: string): Promise<void> {
  await api.post(`/athletes/${athleteId}/affiliations`, { athleteId, clubId, startedAt: '2024-01-01' })
}

export interface CreateTournamentOptions {
  name?: string
  level?: TournamentLevel
  startDate?: string
  endDate?: string
  /** Leva o torneio até este status pelas transições do ciclo de vida (padrão: `draft`). */
  status?: 'draft' | 'registration_open' | 'registration_closed' | 'in_progress'
}

const LIFECYCLE: TournamentStatus[] = ['draft', 'registration_open', 'registration_closed', 'in_progress']

export async function createTournament(options: CreateTournamentOptions = {}): Promise<Tournament> {
  const tag = uniqueTag()
  const name = options.name ?? `Torneio E2E ${tag}`
  const created = await api.post<Tournament>('/tournaments', {
    name,
    slug: `torneio-e2e-${tag}`,
    level: options.level ?? 'state',
    city: 'São Paulo',
    state: 'SP',
    location: 'Ginásio E2E',
    startDate: options.startDate ?? '2098-03-10',
    endDate: options.endDate ?? '2098-03-12',
  })
  let current = created
  const target = options.status ?? 'draft'
  for (const step of LIFECYCLE.slice(1, LIFECYCLE.indexOf(target) + 1)) {
    current = await api.post<Tournament>(`/tournaments/${created.id}/transition`, { to: step })
  }
  return current
}

export function transition(tournamentId: string, to: TournamentStatus): Promise<Tournament> {
  return api.post<Tournament>(`/tournaments/${tournamentId}/transition`, { to })
}

export function createCategory(
  tournamentId: string,
  options: { name?: string; discipline?: Discipline; drawType?: 'single_elimination' | 'round_robin' | 'group_then_elimination' | 'swiss' } = {},
): Promise<Category> {
  return api.post<Category>(`/tournaments/${tournamentId}/categories`, {
    name: options.name ?? 'Simples Masculino',
    discipline: options.discipline ?? 'MS',
    ...(options.drawType ? { drawType: options.drawType } : {}),
  })
}

/** Inscreve e aprova cada atleta (só aprovadas entram na chave). Devolve as inscrições na ordem recebida. */
export async function registerApproved(categoryId: string, athletes: readonly Athlete[]): Promise<Registration[]> {
  const registrations: Registration[] = []
  for (const athlete of athletes) {
    const reg = await api.post<Registration>(`/tournaments/categories/${categoryId}/register`, {
      athleteId: athlete.id,
    })
    registrations.push(await api.post<Registration>(`/registrations/${reg.id}/approve`, {}))
  }
  return registrations
}

export async function generateDraw(categoryId: string, mode: 'random' | 'seeded' = 'random'): Promise<Draw> {
  const res = await api.post<{ draw: Draw }>(`/draws/generate/${categoryId}`, { mode })
  return res.draw
}

export function publishDraw(drawId: string): Promise<Draw> {
  return api.post<Draw>(`/draws/${drawId}/publish`)
}

export function listMatches(drawId: string): Promise<Match[]> {
  return api.get<Match[]>(`/draws/${drawId}/matches`)
}

export interface SetScore {
  score1: number
  score2: number
}

export const SIDE1_WINS: readonly SetScore[] = [
  { score1: 21, score2: 15 },
  { score1: 21, score2: 12 },
]
export const SIDE2_WINS: readonly SetScore[] = [
  { score1: 15, score2: 21 },
  { score1: 12, score2: 21 },
]

/** Grava o resultado de uma partida (sets na ordem). Padrão: o lado 1 vence por 2 a 0. */
export function recordResult(
  matchId: string,
  sets: readonly SetScore[] = SIDE1_WINS,
  status: 'completed' | 'walkover' | 'retired' = 'completed',
): Promise<unknown> {
  return api.post(`/draws/matches/${matchId}/result`, {
    sets: sets.map((s, i) => ({ setNumber: i + 1, ...s })),
    status,
  })
}

/**
 * Joga a chave inteira: a cada rodada (da primeira fase à final) o lado 1 vence todas as partidas
 * prontas. Com `winner: 2`, é o lado 2. Leva o torneio a ter todas as partidas encerradas.
 */
export async function playWholeDraw(drawId: string, winner: 1 | 2 = 1): Promise<void> {
  for (let guard = 0; guard < 16; guard++) {
    const matches = await listMatches(drawId)
    const playable = matches.filter(
      (m) => m.status === 'pending' && m.registration1Id !== null && m.registration2Id !== null,
    )
    if (playable.length === 0) return
    for (const match of playable) {
      await recordResult(match.id, winner === 1 ? SIDE1_WINS : SIDE2_WINS)
    }
  }
  throw new Error('playWholeDraw não terminou: a chave tem partidas que nunca ficam prontas.')
}

export interface PreparedTournament {
  tournament: Tournament
  category: Category
  athletes: Athlete[]
  registrations: Registration[]
  draw: Draw
  matches: Match[]
}

/**
 * Torneio de simples masculino (por padrão em andamento), com `athleteCount` atletas aprovados e a chave
 * sorteada. `publish` publica a chave (necessário para a página pública).
 */
export async function prepareTournament(
  options: {
    athleteCount?: number
    publish?: boolean
    level?: TournamentLevel
    name?: string
    startDate?: string
    endDate?: string
    status?: 'registration_open' | 'registration_closed' | 'in_progress'
    /** Atletas já criados (por exemplo, com nomes acentuados); o padrão cria `athleteCount` atletas. */
    athletes?: Athlete[]
    drawType?: 'single_elimination' | 'round_robin' | 'group_then_elimination' | 'swiss'
  } = {},
): Promise<PreparedTournament> {
  const tournament = await createTournament({
    status: options.status ?? 'in_progress',
    ...(options.level ? { level: options.level } : {}),
    ...(options.name ? { name: options.name } : {}),
    ...(options.startDate ? { startDate: options.startDate } : {}),
    ...(options.endDate ? { endDate: options.endDate } : {}),
  })
  const category = await createCategory(tournament.id, options.drawType ? { drawType: options.drawType } : {})
  const athletes = options.athletes ?? (await createAthletes(options.athleteCount ?? 4, { gender: 'M' }))
  const registrations = await registerApproved(category.id, athletes)
  const draw = await generateDraw(category.id, 'random')
  if (options.publish ?? true) await publishDraw(draw.id)
  const matches = await listMatches(draw.id)
  return { tournament, category, athletes, registrations, draw, matches }
}

export interface FinalizeReport {
  message: string
  report: { categoryId: string; podium: { placement: number; athleteId: string; athleteName: string }[] }[]
}

export function finalizeTournament(tournamentId: string): Promise<FinalizeReport> {
  return api.post<FinalizeReport>(`/tournaments/${tournamentId}/finalize`)
}

/** Joga tudo (lado 1 vence) e encerra o torneio. */
export async function completeTournament(prepared: PreparedTournament): Promise<FinalizeReport> {
  await playWholeDraw(prepared.draw.id)
  return finalizeTournament(prepared.tournament.id)
}

export async function createRankingWithRules(options: {
  discipline?: Discipline
  year: number
  level?: TournamentLevel
}): Promise<Ranking> {
  const tag = uniqueTag()
  const ranking = await api.post<Ranking>('/rankings', {
    name: `Ranking E2E ${tag}`,
    slug: `ranking-e2e-${tag}`,
    discipline: options.discipline ?? 'MS',
    year: options.year,
    minTournamentsRequired: 0,
  })
  await api.post(`/rankings/${ranking.id}/point-rules`, {
    tournamentLevel: options.level ?? 'state',
    multiplier: 1,
    participationBonus: 5,
    entries: [
      { placement: 1, basePoints: 100 },
      { placement: 2, basePoints: 70 },
      { placement: 3, basePoints: 50 },
    ],
  })
  return ranking
}

/** Define quadra e horário de uma partida (o placar ao vivo usa a quadra da agenda). */
export function scheduleMatch(matchId: string, courtNumber: number | null, scheduledAt: string | null = null): Promise<Match> {
  return api.patch<Match>(`/draws/matches/${matchId}/schedule`, { scheduledAt, courtNumber })
}

export interface LiveMatchView {
  matchId: string
  participant1: string | null
  participant2: string | null
  courtNumber: number | null
  status: string
  winner: 1 | 2 | null
  version: number
  sets: SetScore[]
  currentSet: SetScore | null
}

export function listLiveMatches(tournamentId: string): Promise<LiveMatchView[]> {
  return api.get<LiveMatchView[]>(`/tournaments/${tournamentId}/live/matches`)
}

/** Dá pontos ao lado informado, direto na API, até a partida ter vencedor (sem o operador clicar 40 vezes). */
export async function scoreUntilDecided(tournamentId: string, matchId: string, side: 1 | 2): Promise<LiveMatchView> {
  for (let guard = 0; guard < 90; guard++) {
    const current = (await listLiveMatches(tournamentId)).find((m) => m.matchId === matchId)
    if (!current) throw new Error(`Partida ${matchId} não está ao vivo.`)
    if (current.winner !== null) return current
    await api.post(`/draws/matches/${matchId}/live/point`, { side, version: current.version })
  }
  throw new Error('A partida não terminou depois de 90 pontos.')
}
