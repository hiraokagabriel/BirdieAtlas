import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { draws, matches, matchResults, tournamentRegistrations, rankingEntries, pointsTables, tournamentCategories, tournaments, rankings, rankingTournaments, athletes } from '../db/schema'
import { eq, and, inArray, or } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const upsertMatchResultSchema = z.object({
  sets: z.array(z.object({ setNumber: z.number(), score1: z.number(), score2: z.number() })),
  status: z.enum(['completed', 'walkover', 'retired']),
})

const scheduleMatchSchema = z.object({
  scheduledAt: z.string().nullable(),
  courtNumber: z.number().nullable(),
})

const generateDrawSchema = z.object({
  mode: z.enum(['random', 'seeded']).default('seeded'),
})

function isGenderCompatible(discipline: string, gender1: 'M' | 'F', gender2?: 'M' | 'F'): boolean {
  if (discipline === 'MS' || discipline === 'MD') return gender1 === 'M' && (gender2 === undefined || gender2 === 'M')
  if (discipline === 'WS' || discipline === 'WD') return gender1 === 'F' && (gender2 === undefined || gender2 === 'F')
  if (discipline === 'XD') {
    if (!gender2) return false
    return (gender1 === 'M' && gender2 === 'F') || (gender1 === 'F' && gender2 === 'M')
  }
  return true
}

const DOUBLES_DISCIPLINES = new Set(['MD', 'WD', 'XD'])

function normalizePair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1]
}

function getWinnerSlot(sets: { score1: number; score2: number }[]): 1 | 2 | null {
  const wins1 = sets.filter((s) => s.score1 > s.score2).length
  const wins2 = sets.filter((s) => s.score2 > s.score1).length
  return wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null
}

function getSlotForPosition(position: number): 'registration1Id' | 'registration2Id' {
  return position % 2 === 1 ? 'registration1Id' : 'registration2Id'
}

function isByeMatch(match: { registration1Id: string | null; registration2Id: string | null }): boolean {
  return match.registration1Id === null || match.registration2Id === null
}

function getWinnerLoserFromSlots(
  match: { registration1Id: string | null; registration2Id: string | null; status: string },
): { winnerRegId: string; loserRegId: string | null } | null {
  const { registration1Id, registration2Id, status } = match
  if (registration2Id === null && registration1Id !== null) {
    return { winnerRegId: registration1Id, loserRegId: null }
  }
  if (registration1Id === null && registration2Id !== null) {
    return { winnerRegId: registration2Id, loserRegId: null }
  }
  if (status === 'walkover' || status === 'retired') {
    if (registration1Id && registration2Id) {
      return { winnerRegId: registration1Id, loserRegId: registration2Id }
    }
  }
  return null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildSlots(
  confirmed: { id: string; seed: number | null }[],
  mode: 'random' | 'seeded',
): (string | null)[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(confirmed.length)))
  const slots: (string | null)[] = new Array(bracketSize).fill(null)

  if (mode === 'random') {
    const shuffled = shuffle(confirmed)
    for (let i = 0; i < shuffled.length; i++) slots[i] = shuffled[i].id
    return slots
  }

  const seeded   = confirmed.filter((r) => r.seed !== null).sort((a, b) => a.seed! - b.seed!)
  const unseeded = shuffle(confirmed.filter((r) => r.seed === null))

  const half    = bracketSize / 2
  const quarter = bracketSize / 4

  const seededPositions: number[] = [
    0,
    bracketSize - 1,
    ...shuffle([half - 1, half]),
    ...shuffle([quarter - 1, quarter, 3 * quarter - 1, 3 * quarter]),
  ]

  for (let i = 0; i < seeded.length && i < seededPositions.length; i++) {
    slots[seededPositions[i]] = seeded[i].id
  }

  let ui = 0
  for (let i = 0; i < bracketSize && ui < unseeded.length; i++) {
    if (slots[i] === null) { slots[i] = unseeded[ui].id; ui++ }
  }

  return slots
}

function buildMatchDefs(
  drawId: string,
  slots: (string | null)[],
): { id: string; drawId: string; round: number; position: number; registration1Id: string | null; registration2Id: string | null; nextMatchId: string | null; status: 'pending' | 'walkover' }[] {
  const bracketSize = slots.length
  const numRounds   = Math.log2(bracketSize)

  type MatchDef = { id: string; drawId: string; round: number; position: number; registration1Id: string | null; registration2Id: string | null; nextMatchId: string | null; status: 'pending' | 'walkover' }
  const matchDefs: MatchDef[] = []

  for (let round = numRounds; round >= 1; round--) {
    const count = Math.pow(2, round - 1)
    for (let pos = 1; pos <= count; pos++) {
      matchDefs.push({ id: randomUUID(), drawId, round, position: pos, registration1Id: null, registration2Id: null, nextMatchId: null, status: 'pending' })
    }
  }

  const firstRoundMatches = matchDefs.filter((m) => m.round === numRounds)
  for (const fm of firstRoundMatches) {
    fm.registration1Id = slots[fm.position - 1] ?? null
    fm.registration2Id = slots[bracketSize - fm.position] ?? null
  }

  for (const match of matchDefs) {
    if (match.round === 1) continue
    const next = matchDefs.find((m) => m.round === match.round - 1 && m.position === Math.ceil(match.position / 2))
    if (next) match.nextMatchId = next.id
  }

  const propagatedMatchIds = new Set<string>()

  const roundsDesc = [...new Set(matchDefs.map((m) => m.round))].sort((a, b) => b - a)
  for (const round of roundsDesc) {
    for (const match of matchDefs.filter((m) => m.round === round)) {
      if (propagatedMatchIds.has(match.id)) continue

      const isBye = match.registration1Id === null || match.registration2Id === null
      const hasAny = match.registration1Id !== null || match.registration2Id !== null
      if (!isBye || !hasAny) continue

      match.status = 'walkover'
      const winnerRegId = match.registration1Id ?? match.registration2Id!

      if (match.nextMatchId) {
        const next = matchDefs.find((m) => m.id === match.nextMatchId)
        if (next) {
          const slot = getSlotForPosition(match.position)
          next[slot] = winnerRegId
          propagatedMatchIds.add(next.id)
        }
      }
    }
  }

  return matchDefs
}

export async function drawsRoutes(app: FastifyInstance) {
  app.get('/tournaments/categories/:categoryId/draws', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    return db.select().from(draws).where(eq(draws.categoryId, categoryId))
  })

  app.post('/draws/generate/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const { mode } = generateDrawSchema.parse(request.body ?? {})

    const registrations = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.categoryId, categoryId))
    const confirmed = registrations.filter((r) => r.confirmed && !r.withdrew)
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 confirmed registrations' })

    const slots      = buildSlots(confirmed, mode)
    const [draw]     = await db.insert(draws).values({ id: randomUUID(), categoryId, drawMode: mode }).returning()
    const matchDefs  = buildMatchDefs(draw.id, slots)

    await db.insert(matches).values(matchDefs)
    return reply.status(201).send({ draw, matchCount: matchDefs.length, mode })
  })

  app.post('/draws/:drawId/redraw', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const { mode }   = generateDrawSchema.parse(request.body ?? {})

    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })

    const existingMatches = await db.select().from(matches).where(eq(matches.drawId, drawId))
    const matchIds = existingMatches.map((m) => m.id)

    if (matchIds.length) {
      await db.delete(matchResults).where(inArray(matchResults.matchId, matchIds))
    }

    await db.delete(matches).where(eq(matches.drawId, drawId))

    const registrations = await db.select().from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.categoryId, draw.categoryId))
    const confirmed = registrations.filter((r) => r.confirmed && !r.withdrew)
    if (confirmed.length < 2) return reply.status(400).send({ error: 'Need at least 2 confirmed registrations' })

    const slots     = buildSlots(confirmed, mode)
    const matchDefs = buildMatchDefs(drawId, slots)

    await db.insert(matches).values(matchDefs)

    const [updated] = await db.update(draws)
      .set({ drawMode: mode, published: false, generatedAt: new Date(), updatedAt: new Date() })
      .where(eq(draws.id, drawId))
      .returning()

    return reply.status(200).send({ draw: updated, matchCount: matchDefs.length, mode })
  })

  app.post('/draws/:drawId/migrate-next-match-id', async (request) => {
    const { drawId } = request.params as { drawId: string }
    const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawId))
    let updated = 0
    for (const match of allMatches) {
      if (match.round === 1) continue
      const next = allMatches.find((m) => m.round === match.round - 1 && m.position === Math.ceil(match.position / 2))
      if (next && match.nextMatchId !== next.id) {
        await db.update(matches).set({ nextMatchId: next.id }).where(eq(matches.id, match.id))
        updated++
      }
    }
    return { updated, total: allMatches.length }
  })

  app.get('/draws/:drawId/matches', async (request) => {
    const { drawId } = request.params as { drawId: string }
    return db.select().from(matches).where(eq(matches.drawId, drawId))
  })

  app.post('/draws/:drawId/publish', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: true, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  app.post('/draws/:drawId/unpublish', async (request, reply) => {
    const { drawId } = request.params as { drawId: string }
    const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    const [updated] = await db.update(draws).set({ published: false, updatedAt: new Date() }).where(eq(draws.id, drawId)).returning()
    return updated
  })

  app.post('/tournaments/:tournamentId/award-points', async (request, reply) => {
    const { tournamentId } = request.params as { tournamentId: string }

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found' })
    if (tournament.pointsAwarded) return reply.status(409).send({ error: 'Points have already been awarded for this tournament' })
    if (!tournament.pointsTableId) return reply.status(400).send({ error: 'Tournament has no pointsTableId configured' })

    const [refTable] = await db.select().from(pointsTables).where(eq(pointsTables.id, tournament.pointsTableId))
    if (!refTable) return reply.status(400).send({ error: 'Points table not found' })

    const allPointsRows = await db.select().from(pointsTables)
      .where(and(
        eq(pointsTables.tenantId, refTable.tenantId),
        eq(pointsTables.name, refTable.name),
        eq(pointsTables.tournamentLevel, refTable.tournamentLevel),
      ))
    if (!allPointsRows.length) return reply.status(400).send({ error: 'Points table rows not found' })

    const pointsMap = new Map(allPointsRows.map((p) => [p.placement, p.points]))

    const tenantRankings = await db.select().from(rankings).where(eq(rankings.tenantId, tournament.tenantId))
    const rankingByDiscipline = new Map(tenantRankings.map((r) => [r.discipline, r]))
    const categories = await db.select().from(tournamentCategories).where(eq(tournamentCategories.tournamentId, tournamentId))

    const awarded: { categoryName: string; registrationId: string; athleteId: string; athlete2Id: string | null; placement: number; points: number }[] = []
    const skipped: { categoryName: string; reason: string }[] = []

    const linkedRankingIds = new Set<string>()

    for (const category of categories) {
      const ranking = rankingByDiscipline.get(category.discipline)
      if (!ranking) { skipped.push({ categoryName: category.name, reason: `No ranking found for discipline ${category.discipline}` }); continue }

      if (!linkedRankingIds.has(ranking.id)) {
        const existing = await db.select().from(rankingTournaments)
          .where(and(eq(rankingTournaments.rankingId, ranking.id), eq(rankingTournaments.tournamentId, tournamentId)))
        if (!existing.length) {
          await db.insert(rankingTournaments)
            .values({ id: randomUUID(), rankingId: ranking.id, tournamentId, isScoring: true })
        }
        linkedRankingIds.add(ranking.id)
      }

      const drawList = await db.select().from(draws).where(eq(draws.categoryId, category.id))
      if (!drawList.length) { skipped.push({ categoryName: category.name, reason: 'No draw generated' }); continue }

      const allMatches = await db.select().from(matches).where(eq(matches.drawId, drawList[0].id))

      const pendingMatches = allMatches.filter(
        (m) => !['completed', 'walkover', 'retired'].includes(m.status) && !isByeMatch(m),
      )
      if (pendingMatches.length > 0) { skipped.push({ categoryName: category.name, reason: `${pendingMatches.length} match(es) still pending` }); continue }

      const placementByReg = new Map<string, number>()

      for (const match of allMatches) {
        if (match.registration1Id === null && match.registration2Id === null) continue

        const sets = await db.select().from(matchResults).where(eq(matchResults.matchId, match.id))

        let winnerRegId: string | null = null
        let loserRegId: string | null = null

        if (sets.length > 0 && match.status === 'completed') {
          const winnerSlot = getWinnerSlot(sets)
          if (!winnerSlot) continue
          winnerRegId = winnerSlot === 1 ? match.registration1Id : match.registration2Id
          loserRegId  = winnerSlot === 1 ? match.registration2Id : match.registration1Id
        } else {
          const result = getWinnerLoserFromSlots(match)
          if (!result) continue
          winnerRegId = result.winnerRegId
          loserRegId  = result.loserRegId
        }

        const loserPlacement = match.round === 1 ? 2 : Math.pow(2, match.round - 1) + 1
        if (loserRegId) placementByReg.set(loserRegId, loserPlacement)
        if (match.round === 1 && winnerRegId) placementByReg.set(winnerRegId, 1)
      }

      const regIds = [...placementByReg.keys()]
      if (!regIds.length) continue
      const regs = await db.select().from(tournamentRegistrations).where(inArray(tournamentRegistrations.id, regIds))

      const allAthleteIds = [...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
      const athleteRows = allAthleteIds.length ? await db.select().from(athletes).where(inArray(athletes.id, allAthleteIds)) : []
      const athleteMap = new Map(athleteRows.map((a) => [a.id, a]))

      const isDoubles = DOUBLES_DISCIPLINES.has(category.discipline)

      for (const [regId, placement] of placementByReg.entries()) {
        const reg = regs.find((r) => r.id === regId)
        if (!reg) continue

        const a1 = athleteMap.get(reg.athleteId)
        const a2 = reg.athlete2Id ? athleteMap.get(reg.athlete2Id) : undefined
        if (!a1) continue

        if (!isGenderCompatible(category.discipline, a1.gender, a2?.gender)) {
          skipped.push({ categoryName: category.name, reason: `Gender incompatible: ${a1.id} in ${category.discipline}` })
          continue
        }

        const points = pointsMap.get(placement) ?? 0
        if (points === 0) {
          skipped.push({ categoryName: category.name, reason: `Placement ${placement} has 0 points in table — skipping athlete ${reg.athleteId}` })
          continue
        }

        if (isDoubles) {
          if (!reg.athlete2Id) {
            skipped.push({ categoryName: category.name, reason: `Doubles category but registration ${regId} has no athlete2Id` })
            continue
          }
          const [normA1, normA2] = normalizePair(reg.athleteId, reg.athlete2Id)
          const existing = await db.select().from(rankingEntries).where(
            and(
              eq(rankingEntries.rankingId, ranking.id),
              or(
                and(eq(rankingEntries.athleteId, normA1), eq(rankingEntries.athlete2Id, normA2)),
                and(eq(rankingEntries.athleteId, normA2), eq(rankingEntries.athlete2Id, normA1)),
              )
            )
          )
          if (existing.length) {
            await db.update(rankingEntries).set({ points: existing[0].points + points, totalPoints: existing[0].totalPoints + points, updatedAt: new Date() }).where(eq(rankingEntries.id, existing[0].id))
          } else {
            await db.insert(rankingEntries).values({ id: randomUUID(), rankingId: ranking.id, athleteId: normA1, athlete2Id: normA2, points, totalPoints: points, position: 0 })
          }
        } else {
          const existing = await db.select().from(rankingEntries).where(
            and(eq(rankingEntries.rankingId, ranking.id), eq(rankingEntries.athleteId, reg.athleteId))
          )
          if (existing.length) {
            await db.update(rankingEntries).set({ points: existing[0].points + points, totalPoints: existing[0].totalPoints + points, updatedAt: new Date() }).where(eq(rankingEntries.id, existing[0].id))
          } else {
            await db.insert(rankingEntries).values({ id: randomUUID(), rankingId: ranking.id, athleteId: reg.athleteId, athlete2Id: null, points, totalPoints: points, position: 0 })
          }
        }

        awarded.push({ categoryName: category.name, registrationId: regId, athleteId: reg.athleteId, athlete2Id: reg.athlete2Id ?? null, placement, points })
      }

      const allEntries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, ranking.id))
      const sortedEntries = [...allEntries].sort((a, b) => b.points - a.points)
      for (let i = 0; i < sortedEntries.length; i++) {
        await db.update(rankingEntries).set({ position: i + 1, updatedAt: new Date() }).where(eq(rankingEntries.id, sortedEntries[i].id))
      }
    }

    await db.update(tournaments).set({ pointsAwarded: true, updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
    return { awarded, skipped }
  })

  app.patch('/draws/matches/:matchId/schedule', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = scheduleMatchSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })
    const [updated] = await db.update(matches)
      .set({ scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, courtNumber: body.courtNumber, updatedAt: new Date() })
      .where(eq(matches.id, matchId)).returning()
    return updated
  })

  app.post('/draws/matches/:matchId/result', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = upsertMatchResultSchema.parse(request.body)
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
    if (!match) return reply.status(404).send({ error: 'Match not found' })

    const newWinner = getWinnerSlot(body.sets)
    if (!newWinner) return reply.status(400).send({ error: 'Cannot determine winner from sets' })
    const newWinnerRegId = newWinner === 1 ? match.registration1Id : match.registration2Id

    const prevResults = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
    const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
    const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id
    const winnerChanged = prevResults.length > 0 && prevWinnerRegId !== newWinnerRegId

    if (winnerChanged && match.nextMatchId) await cascadeReset(match.nextMatchId, prevWinnerRegId)
    if (prevResults.length) await db.delete(matchResults).where(eq(matchResults.matchId, matchId))

    await db.update(matches).set({ status: body.status, updatedAt: new Date() }).where(eq(matches.id, matchId))
    const results = await db.insert(matchResults).values(
      body.sets.map((s) => ({ id: randomUUID(), matchId, setNumber: s.setNumber, score1: s.score1, score2: s.score2 }))
    ).returning()

    if (match.nextMatchId) {
      const slot = getSlotForPosition(match.position)
      await db.update(matches).set({ [slot]: newWinnerRegId, updatedAt: new Date() }).where(eq(matches.id, match.nextMatchId))
    }

    return { match: { ...match, status: body.status }, results }
  })

  app.get('/draws/matches/:matchId/result', async (request) => {
    const { matchId } = request.params as { matchId: string }
    return db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  })
}

async function cascadeReset(matchId: string, regIdToRemove: string | null): Promise<void> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!match) return
  const isSlot1 = match.registration1Id === regIdToRemove
  const isSlot2 = match.registration2Id === regIdToRemove
  if (!isSlot1 && !isSlot2) return
  const prevResults = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  const prevWinner = prevResults.length ? getWinnerSlot(prevResults) : null
  const prevWinnerRegId = prevWinner === 1 ? match.registration1Id : match.registration2Id
  await db.delete(matchResults).where(eq(matchResults.matchId, matchId))
  await db.update(matches)
    .set({ [isSlot1 ? 'registration1Id' : 'registration2Id']: null, status: 'pending', updatedAt: new Date() })
    .where(eq(matches.id, matchId))
  if (match.nextMatchId && prevWinnerRegId) await cascadeReset(match.nextMatchId, prevWinnerRegId)
}
