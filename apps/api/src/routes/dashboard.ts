import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import {
  athletes, clubs, athleteAffiliations,
  tournaments, tournamentCategories, draws, matches, matchResults,
  tournamentRegistrations,
} from '../db/schema'
import { eq, inArray, or } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function athleteDisplayName(a: { name: string } | null): string {
  return a?.name ?? '?'
}

function pairName(a1: { name: string } | null, a2: { name: string } | null): string {
  if (a2) return `${athleteDisplayName(a1)} / ${athleteDisplayName(a2)}`
  return athleteDisplayName(a1)
}

function roundLabel(round: number): string {
  if (round === 1) return 'Final'
  if (round === 2) return 'Semifinal'
  if (round === 3) return 'Quartas'
  return `Rodada ${round}`
}

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const w1 = sets.filter((s) => s.score1 > s.score2).length
  const w2 = sets.filter((s) => s.score2 > s.score1).length
  return w1 > w2 ? 1 : w2 > w1 ? 2 : null
}

function scoreString(sets: { setNumber: number; score1: number; score2: number }[]): string {
  return sets
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => `${s.score1}-${s.score2}`)
    .join(', ')
}

// ---------------------------------------------------------------------------
// Resolve registration -> athlete names
// ---------------------------------------------------------------------------
async function buildRegAthleteMap(regIds: string[]) {
  if (!regIds.length) return new Map<string, { a1Name: string; a2Name: string | null }>()

  const regs = await db.select().from(tournamentRegistrations)
    .where(inArray(tournamentRegistrations.id, regIds))

  const athleteIds = [...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
  const athleteRows = athleteIds.length
    ? await db.select().from(athletes).where(inArray(athletes.id, athleteIds))
    : []
  const athleteMap = new Map(athleteRows.map((a) => [a.id, a]))

  const result = new Map<string, { a1Name: string; a2Name: string | null }>()
  for (const r of regs) {
    const a1 = athleteMap.get(r.athleteId) ?? null
    const a2 = r.athlete2Id ? (athleteMap.get(r.athlete2Id) ?? null) : null
    result.set(r.id, { a1Name: athleteDisplayName(a1), a2Name: a2?.name ?? null })
  }
  return result
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export async function dashboardRoutes(app: FastifyInstance) {

  // -------------------------------------------------------------------------
  // GET /dashboard/stats
  // -------------------------------------------------------------------------
  app.get('/dashboard/stats', async () => {
    const [allAthletes, allClubs, allTournaments] = await Promise.all([
      db.select().from(athletes),
      db.select().from(clubs),
      db.select().from(tournaments),
    ])

    const totalAthletes = allAthletes.filter((a) => a.active).length
    const totalClubs    = allClubs.filter((c) => c.active).length

    // Conta disciplinas únicas dentre torneios ativos (in_progress)
    const activeTournamentIds = allTournaments
      .filter((t) => t.status === 'in_progress')
      .map((t) => t.id)

    let activeCategories = 0
    if (activeTournamentIds.length) {
      const cats = await db.select().from(tournamentCategories)
        .where(inArray(tournamentCategories.tournamentId, activeTournamentIds))
      const uniqueDisciplines = new Set(cats.map((c) => c.discipline))
      activeCategories = uniqueDisciplines.size
    }

    // Partidas disputadas e pendentes (em todos os torneios in_progress)
    let matchesPlayed  = 0
    let matchesPending = 0

    if (activeTournamentIds.length) {
      const cats = await db.select().from(tournamentCategories)
        .where(inArray(tournamentCategories.tournamentId, activeTournamentIds))
      const catIds = cats.map((c) => c.id)

      if (catIds.length) {
        const drawList = await db.select().from(draws)
          .where(inArray(draws.categoryId, catIds))
        const drawIds = drawList.map((d) => d.id)

        if (drawIds.length) {
          const allMatches = await db.select().from(matches)
            .where(inArray(matches.drawId, drawIds))
          matchesPlayed  = allMatches.filter((m) => ['completed', 'walkover', 'retired'].includes(m.status)).length
          matchesPending = allMatches.filter((m) => ['pending', 'in_progress'].includes(m.status)).length
        }
      }
    }

    return { totalAthletes, totalClubs, activeCategories, matchesPlayed, matchesPending }
  })

  // -------------------------------------------------------------------------
  // GET /dashboard/recent-matches
  // Returns last 10 completed matches across all in_progress tournaments
  // -------------------------------------------------------------------------
  app.get('/dashboard/recent-matches', async () => {
    const activeTournaments = await db.select().from(tournaments)
      .then((rows) => rows.filter((t) => t.status === 'in_progress'))

    if (!activeTournaments.length) return []

    const cats = await db.select().from(tournamentCategories)
      .where(inArray(tournamentCategories.tournamentId, activeTournaments.map((t) => t.id)))

    if (!cats.length) return []

    const drawList = await db.select().from(draws)
      .where(inArray(draws.categoryId, cats.map((c) => c.id)))

    if (!drawList.length) return []

    const allMatches = await db.select().from(matches)
      .where(inArray(matches.drawId, drawList.map((d) => d.id)))

    const completedMatches = allMatches
      .filter((m) => ['completed', 'walkover', 'retired'].includes(m.status) && (m.registration1Id || m.registration2Id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)

    if (!completedMatches.length) return []

    // Draw -> category map
    const drawCatMap = new Map(drawList.map((d) => [d.id, cats.find((c) => c.id === d.categoryId)]))

    // Busca resultados e atletas
    const regIds = [...new Set(completedMatches.flatMap((m) => [m.registration1Id, m.registration2Id].filter(Boolean) as string[]))]
    const [regAthleteMap, allResults] = await Promise.all([
      buildRegAthleteMap(regIds),
      db.select().from(matchResults).where(inArray(matchResults.matchId, completedMatches.map((m) => m.id))),
    ])

    return completedMatches.map((match) => {
      const cat = drawCatMap.get(match.drawId)
      const sets = allResults.filter((r) => r.matchId === match.id)
      const winner = getWinnerSlot(sets)

      const reg1 = match.registration1Id ? regAthleteMap.get(match.registration1Id) : null
      const reg2 = match.registration2Id ? regAthleteMap.get(match.registration2Id) : null

      const name1 = reg1 ? pairName({ name: reg1.a1Name }, reg1.a2Name ? { name: reg1.a2Name } : null) : 'BYE'
      const name2 = reg2 ? pairName({ name: reg2.a1Name }, reg2.a2Name ? { name: reg2.a2Name } : null) : 'BYE'

      const winnerName = winner === 1 ? name1 : winner === 2 ? name2 : name1
      const loserName  = winner === 1 ? name2 : winner === 2 ? name1 : name2

      return {
        matchId:      match.id,
        categoryName: cat?.name ?? '—',
        discipline:   cat?.discipline ?? '—',
        round:        match.round,
        winnerName,
        loserName,
        score:        scoreString(sets),
        completedAt:  match.updatedAt,
      }
    })
  })

  // -------------------------------------------------------------------------
  // GET /dashboard/upcoming-matches
  // Returns pending + in_progress matches across all in_progress tournaments
  // -------------------------------------------------------------------------
  app.get('/dashboard/upcoming-matches', async () => {
    const activeTournaments = await db.select().from(tournaments)
      .then((rows) => rows.filter((t) => t.status === 'in_progress'))

    if (!activeTournaments.length) return []

    const cats = await db.select().from(tournamentCategories)
      .where(inArray(tournamentCategories.tournamentId, activeTournaments.map((t) => t.id)))

    if (!cats.length) return []

    const drawList = await db.select().from(draws)
      .where(inArray(draws.categoryId, cats.map((c) => c.id)))

    if (!drawList.length) return []

    const allMatches = await db.select().from(matches)
      .where(inArray(matches.drawId, drawList.map((d) => d.id)))

    // Só partidas com ambos os participantes definidos
    const upcoming = allMatches
      .filter((m) =>
        ['pending', 'in_progress'].includes(m.status) &&
        m.registration1Id && m.registration2Id
      )
      .sort((a, b) => {
        // in_progress primeiro, depois por scheduledAt
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1
        if (a.scheduledAt && b.scheduledAt) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        if (a.scheduledAt) return -1
        if (b.scheduledAt) return 1
        return a.round - b.round
      })
      .slice(0, 10)

    if (!upcoming.length) return []

    const drawCatMap = new Map(drawList.map((d) => [d.id, cats.find((c) => c.id === d.categoryId)]))

    const regIds = [...new Set(upcoming.flatMap((m) => [m.registration1Id, m.registration2Id].filter(Boolean) as string[]))]
    const regAthleteMap = await buildRegAthleteMap(regIds)

    return upcoming.map((match) => {
      const cat  = drawCatMap.get(match.drawId)
      const reg1 = match.registration1Id ? regAthleteMap.get(match.registration1Id) : null
      const reg2 = match.registration2Id ? regAthleteMap.get(match.registration2Id) : null

      const player1 = reg1 ? pairName({ name: reg1.a1Name }, reg1.a2Name ? { name: reg1.a2Name } : null) : 'BYE'
      const player2 = reg2 ? pairName({ name: reg2.a1Name }, reg2.a2Name ? { name: reg2.a2Name } : null) : 'BYE'

      return {
        matchId:      match.id,
        categoryName: cat?.name ?? '—',
        discipline:   cat?.discipline ?? '—',
        round:        match.round,
        player1,
        player2,
        scheduledAt:  match.scheduledAt ?? null,
        courtNumber:  match.courtNumber ?? null,
        status:       match.status as 'pending' | 'in_progress',
      }
    })
  })
}
