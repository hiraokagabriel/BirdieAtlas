import type { FastifyInstance } from 'fastify'
import { db } from '../db/index'
import { draws, matches, matchResults, tournamentRegistrations } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const updateMatchResultSchema = z.object({
  sets: z.array(
    z.object({
      setNumber: z.number(),
      score1: z.number(),
      score2: z.number(),
    })
  ),
  status: z.enum(['completed', 'walkover', 'retired']),
})

export async function drawsRoutes(app: FastifyInstance) {
  // Lista draws de uma categoria
  app.get('/tournaments/categories/:categoryId/draws', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    return db.select().from(draws).where(eq(draws.categoryId, categoryId))
  })

  // Gera chaveamento para uma categoria com base nas inscrições confirmadas
  app.post('/draws/generate/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }

    const registrations = await db
      .select()
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.categoryId, categoryId))

    const confirmed = registrations.filter((r) => r.confirmed && !r.withdrew)
    if (confirmed.length < 2) {
      return reply.status(400).send({ error: 'Need at least 2 confirmed registrations' })
    }

    const sorted = confirmed.sort((a, b) => {
      if (a.seed && b.seed) return a.seed - b.seed
      if (a.seed) return -1
      if (b.seed) return 1
      return (b.rankingPointsAtEntry ?? 0) - (a.rankingPointsAtEntry ?? 0)
    })

    const numEntries = sorted.length
    const numRounds = Math.ceil(Math.log2(numEntries))
    const bracketSize = Math.pow(2, numRounds)

    const [draw] = await db
      .insert(draws)
      .values({ id: randomUUID(), categoryId })
      .returning()

    const matchesToCreate = []
    for (let pos = 1; pos <= bracketSize / 2; pos++) {
      const idx1 = pos - 1
      const idx2 = bracketSize - pos
      matchesToCreate.push({
        id: randomUUID(),
        drawId: draw.id,
        round: numRounds,
        position: pos,
        registration1Id: sorted[idx1]?.id ?? null,
        registration2Id: sorted[idx2]?.id ?? null,
        status: 'pending' as const,
      })
    }

    for (let round = numRounds - 1; round >= 1; round--) {
      const numMatches = Math.pow(2, round - 1)
      for (let pos = 1; pos <= numMatches; pos++) {
        matchesToCreate.push({
          id: randomUUID(),
          drawId: draw.id,
          round,
          position: pos,
          registration1Id: null,
          registration2Id: null,
          status: 'pending' as const,
        })
      }
    }

    await db.insert(matches).values(matchesToCreate)
    return reply.status(201).send({ draw, matchCount: matchesToCreate.length })
  })

  app.get('/draws/:drawId/matches', async (request) => {
    const { drawId } = request.params as { drawId: string }
    return db.select().from(matches).where(eq(matches.drawId, drawId))
  })

  app.post('/draws/matches/:matchId/result', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const body = updateMatchResultSchema.parse(request.body)

    const [match] = await db
      .update(matches)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(matches.id, matchId))
      .returning()

    if (!match) return reply.status(404).send({ error: 'Match not found' })

    const results = await db
      .insert(matchResults)
      .values(
        body.sets.map((s) => ({
          id: randomUUID(),
          matchId,
          setNumber: s.setNumber,
          score1: s.score1,
          score2: s.score2,
        }))
      )
      .returning()

    return { match, results }
  })

  app.get('/draws/matches/:matchId/result', async (request) => {
    const { matchId } = request.params as { matchId: string }
    return db.select().from(matchResults).where(eq(matchResults.matchId, matchId))
  })
}
