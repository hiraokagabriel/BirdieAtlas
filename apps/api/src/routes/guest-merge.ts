import type { FastifyInstance } from 'fastify'
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { athletes, pairs, rankingEntries, tournamentCategories, tournamentRegistrations } from '../db/schema.js'
import { checkGuestMerge, planPairMerge, sharedCategories, type MergeRefusal } from '../domain/guest-merge.js'

// Juntar um avulso a um atleta cadastrado (admin; a escrita passa pelo guard global).
// Ver ESPECIFICACAO_COMPLETA.md, "Avulsos".

const params = z.object({ id: z.string().min(1) })
const body = z.object({ targetAthleteId: z.string().min(1) })

class MergeError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message)
  }
}

const refuse = (r: MergeRefusal) => new MergeError(r.status, r.code, r.error)

export async function guestMergeRoutes(app: FastifyInstance) {
  app.post('/athletes/:id/merge', async (request, reply) => {
    const { id } = params.parse(request.params)
    const { targetAthleteId } = body.parse(request.body)

    try {
      const result = await db.transaction(async (tx) => {
        // Mesmo lock da lista colada e da planilha amistosa: ninguém reaproveita o avulso enquanto ele some.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('athletes:guest'))`)

        const found = await tx.select({ id: athletes.id, guest: athletes.guest, gender: athletes.gender, birthYear: athletes.birthYear, name: athletes.name })
          .from(athletes).where(and(inArray(athletes.id, [id, targetAthleteId]), isNull(athletes.deletedAt))).for('update')
        const source = found.find((a) => a.id === id)
        const target = found.find((a) => a.id === targetAthleteId)
        if (!source) throw new MergeError(404, 'ATHLETE_NOT_FOUND', 'Jogador avulso não encontrado.')
        if (!target) throw new MergeError(404, 'TARGET_NOT_FOUND', 'Atleta de destino não encontrado.')
        const refusal = checkGuestMerge(source, target)
        if (refusal) throw refuse(refusal)

        // Inclui as duplas excluídas do avulso: o histórico delas também passa para o atleta. Trava as linhas lidas.
        const pairRows = (await tx.select({ id: pairs.id, athlete1Id: pairs.athlete1Id, athlete2Id: pairs.athlete2Id, discipline: pairs.discipline, deletedAt: pairs.deletedAt, active: pairs.active })
          .from(pairs)
          .where(and(or(eq(pairs.athlete1Id, id), eq(pairs.athlete2Id, id), eq(pairs.athlete1Id, targetAthleteId), eq(pairs.athlete2Id, targetAthleteId))))
          .for('update'))
          .map((p) => ({ ...p, deleted: p.deletedAt !== null }))
        const plan = planPairMerge(pairRows, id, targetAthleteId)
        if (plan.conflict) throw new MergeError(409, 'MERGE_CONFLICT', 'O avulso tem dupla com o próprio atleta: exclua essa dupla antes de juntar.')

        // Inscrições ativas (não recusadas) de cada um, simples e duplas: depois da junção o atleta não pode
        // aparecer duas vezes na mesma categoria.
        const pairsOf = (athleteId: string) => pairRows.filter((p) => !p.deleted &&  p.athlete1Id === athleteId || p.athlete2Id === athleteId).map((p) => p.id)
        const activeCategories = async (athleteId: string) => {
          const pairIds = pairsOf(athleteId)
          const rows = await tx.select({ categoryId: tournamentRegistrations.categoryId }).from(tournamentRegistrations)
            .where(and(isNull(tournamentRegistrations.deletedAt), ne(tournamentRegistrations.status, 'rejected'),
              pairIds.length ? or(eq(tournamentRegistrations.athleteId, athleteId), inArray(tournamentRegistrations.pairId, pairIds)) : eq(tournamentRegistrations.athleteId, athleteId)))
          return rows.map((r) => r.categoryId)
        }
        const shared = sharedCategories(await activeCategories(id), await activeCategories(targetAthleteId))
        if (shared.length) {
          const names = await tx.select({ name: tournamentCategories.name }).from(tournamentCategories).where(inArray(tournamentCategories.id, shared))
          throw new MergeError(409, 'MERGE_CONFLICT', 'Os dois já estão inscritos na mesma categoria. Remova uma das inscrições antes de juntar.',
            { categories: names.map((n) => n.name) })
        }

        // Os dois no mesmo ranking: juntar duplicaria a linha do atleta.
        const rankingRows = await tx.select({ rankingId: rankingEntries.rankingId, athleteId: rankingEntries.athleteId, athlete2Id: rankingEntries.athlete2Id })
          .from(rankingEntries).where(or(inArray(rankingEntries.athleteId, [id, targetAthleteId]), inArray(rankingEntries.athlete2Id, [id, targetAthleteId])))
        const rankingsOf = (a: string) => rankingRows.filter((r) => r.athleteId === a || r.athlete2Id === a).map((r) => r.rankingId)
        if (sharedCategories(rankingsOf(id), rankingsOf(targetAthleteId)).length) {
          throw new MergeError(409, 'MERGE_CONFLICT', 'Os dois já aparecem no mesmo ranking. Recalcule ou ajuste o ranking antes de juntar.')
        }

        const now = new Date()
        const singles = await tx.update(tournamentRegistrations).set({ athleteId: targetAthleteId, updatedAt: now })
          .where(eq(tournamentRegistrations.athleteId, id)).returning({ id: tournamentRegistrations.id })
        for (const step of plan.steps) {
          if (step.action === 'update') {
            await tx.update(pairs).set({ [step.column]: targetAthleteId, updatedAt: now }).where(eq(pairs.id, step.pairId))
          } else {
            await tx.update(tournamentRegistrations).set({ pairId: step.intoPairId, updatedAt: now }).where(eq(tournamentRegistrations.pairId, step.pairId))
            await tx.update(pairs).set({ deletedAt: now, active: false, updatedAt: now }).where(eq(pairs.id, step.pairId))
          }
        }
        await tx.update(rankingEntries).set({ athleteId: targetAthleteId }).where(eq(rankingEntries.athleteId, id))
        await tx.update(rankingEntries).set({ athlete2Id: targetAthleteId }).where(eq(rankingEntries.athlete2Id, id))
        if (target.birthYear === null && source.birthYear !== null) {
          await tx.update(athletes).set({ birthYear: source.birthYear, updatedAt: now }).where(eq(athletes.id, targetAthleteId))
        }
        await tx.update(athletes).set({ deletedAt: now, active: false, updatedAt: now }).where(eq(athletes.id, id))

        return { target: { id: target.id, name: target.name }, registrationsMoved: singles.length, pairsUpdated: plan.steps.length }
      })
      return reply.send(result)
    } catch (err) {
      // Inscrição ou dupla criada ao mesmo tempo por outra tela: o índice único recusa; vira conflito, não 500.
      if ((err as { code?: string }).code === '23505') {
        return reply.status(409).send({ error: 'Outra alteração mexeu nas inscrições ao mesmo tempo. Tente de novo.', code: 'MERGE_CONFLICT' })
      }
      if (err instanceof MergeError) {
        return reply.status(err.status).send({ error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) })
      }
      throw err
    }
  })
}
