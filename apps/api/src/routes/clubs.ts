import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { clubs, athletes, athleteAffiliations, rankings, rankingEntries } from '../db/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const urlOrEmpty = z.union([z.string().url(), z.literal(''), z.undefined()])

const createClubSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  tenantId: z.string(),
  city: z.string().optional(),
  state: z.string().optional(),
  logoUrl: urlOrEmpty,
  coverUrl: urlOrEmpty,
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
})

export async function clubsRoutes(app: FastifyInstance) {
  app.get('/clubs', async (request) => {
    const { tenantId } = request.query as { tenantId?: string }
    if (tenantId) return db.select().from(clubs).where(eq(clubs.tenantId, tenantId))
    return db.select().from(clubs)
  })

  app.get('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id))
    if (!club) return reply.status(404).send({ error: 'Club not found' })
    return club
  })

  app.get('/clubs/:id/profile', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id))
    if (!club) return reply.status(404).send({ error: 'Club not found' })

    const currentAffiliations = await db
      .select().from(athleteAffiliations)
      .where(and(eq(athleteAffiliations.clubId, id), isNull(athleteAffiliations.endedAt)))

    if (!currentAffiliations.length) {
      return { club, roster: [], totalPoints: 0, avgPoints: 0, rankAmongClubs: null, totalClubs: 0 }
    }

    const athleteIds = currentAffiliations.map((a) => a.athleteId)
    const rosterAthletes = await db.select().from(athletes).where(inArray(athletes.id, athleteIds))

    const tenantRankings = await db
      .select().from(rankings)
      .where(and(eq(rankings.tenantId, club.tenantId), eq(rankings.active, true)))

    const rankingIds = tenantRankings.map((r) => r.id)
    const rankingMap = new Map(tenantRankings.map((r) => [r.id, r]))

    const entries = rankingIds.length
      ? await db.select().from(rankingEntries)
          .where(and(inArray(rankingEntries.rankingId, rankingIds), inArray(rankingEntries.athleteId, athleteIds)))
      : []

    const pointsByAthlete = new Map<string, { total: number; byDiscipline: Record<string, number> }>()
    for (const entry of entries) {
      const ranking = rankingMap.get(entry.rankingId)
      if (!ranking) continue
      const current = pointsByAthlete.get(entry.athleteId) ?? { total: 0, byDiscipline: {} }
      current.total += entry.points
      current.byDiscipline[ranking.discipline] = (current.byDiscipline[ranking.discipline] ?? 0) + entry.points
      pointsByAthlete.set(entry.athleteId, current)
    }

    const roster = rosterAthletes.map((a) => {
      const pts = pointsByAthlete.get(a.id) ?? { total: 0, byDiscipline: {} }
      return { id: a.id, name: a.name, gender: a.gender, birthDate: a.birthDate, photoUrl: a.photoUrl, active: a.active, totalPoints: pts.total, byDiscipline: pts.byDiscipline }
    })

    const totalPoints = roster.reduce((s, a) => s + a.totalPoints, 0)
    const avgPoints   = roster.length ? Math.round(totalPoints / roster.length) : 0

    const allAffiliations = await db.select().from(athleteAffiliations)
      .where(and(eq(athleteAffiliations.tenantId, club.tenantId), isNull(athleteAffiliations.endedAt)))

    const allEntries = rankingIds.length
      ? await db.select().from(rankingEntries).where(inArray(rankingEntries.rankingId, rankingIds))
      : []

    const allEntriesMap = new Map<string, number>()
    for (const e of allEntries) allEntriesMap.set(e.athleteId, (allEntriesMap.get(e.athleteId) ?? 0) + e.points)

    const clubTotals = new Map<string, number>()
    for (const aff of allAffiliations) {
      const pts = allEntriesMap.get(aff.athleteId) ?? 0
      clubTotals.set(aff.clubId, (clubTotals.get(aff.clubId) ?? 0) + pts)
    }

    const sortedClubs  = [...clubTotals.entries()].sort((a, b) => b[1] - a[1])
    const rankIndex    = sortedClubs.findIndex(([cId]) => cId === id)
    const rankAmongClubs = rankIndex >= 0 ? rankIndex + 1 : null

    return { club, roster, totalPoints, avgPoints, rankAmongClubs, totalClubs: sortedClubs.length }
  })

  app.post('/clubs', async (request, reply) => {
    const body = createClubSchema.parse(request.body)
    const [club] = await db.insert(clubs).values({ id: randomUUID(), ...body }).returning()
    return reply.status(201).send(club)
  })

  app.put('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    // tenantId é optional no update — nunca deve mudar, mas não precisa ser enviado
    const updateSchema = createClubSchema.omit({ tenantId: true }).partial()
    const body = updateSchema.parse(request.body)
    // converte string vazia em null para não gravar URL inválida
    const payload = {
      ...body,
      logoUrl: body.logoUrl === '' ? null : body.logoUrl,
      coverUrl: body.coverUrl === '' ? null : body.coverUrl,
      updatedAt: new Date(),
    }
    const [club] = await db.update(clubs).set(payload).where(eq(clubs.id, id)).returning()
    if (!club) return reply.status(404).send({ error: 'Club not found' })
    return club
  })

  app.delete('/clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await db.delete(clubs).where(eq(clubs.id, id))
    return reply.status(204).send()
  })
}
