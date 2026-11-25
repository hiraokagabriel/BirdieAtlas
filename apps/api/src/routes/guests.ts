import type { FastifyInstance } from 'fastify'
import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { db } from '../db/index.js'
import { athletes, pairs, tournamentCategories, tournamentRegistrations, tournaments } from '../db/schema.js'
import { selectRegistrations } from '../db/registrations.js'
import { checkRegistrationEligibility } from '../domain/eligibility.js'
import { canEditRegistration } from '../domain/registration-rules.js'
import { GUEST_LIST_MAX_LINES, GUEST_NAME_MAX, matchGuest, parseGuestList, type GuestCandidate, type GuestListError } from '../domain/guest-list.js'

// Avulsos do torneio amistoso: o organizador cola a lista de inscritos de uma categoria e cada nome vira (ou
// reaproveita) um atleta avulso (`athletes.guest`), inscrito e aprovado. Ver ESPECIFICACAO_COMPLETA.md,
// "Torneio oficial e amistoso > Avulsos".

const paramsSchema = z.object({ categoryId: z.string().min(1) })
// Cabe a lista mais longa que o domínio aceita (256 duplas com nomes de 120 caracteres e o ano).
const bodySchema = z.object({ text: z.string().min(1, 'Cole ao menos um nome.').max(GUEST_LIST_MAX_LINES * (2 * GUEST_NAME_MAX + 16)) })

/** Falha de uma linha dentro da transação: desfaz o lote inteiro. */
class GuestBatchError extends Error {
  constructor(readonly errors: GuestListError[]) {
    super('guest batch')
  }
}

export async function guestsRoutes(app: FastifyInstance) {
  app.post('/tournaments/categories/:categoryId/guests', async (request, reply) => {
    const { categoryId } = paramsSchema.parse(request.params)
    const { text } = bodySchema.parse(request.body)

    const [category] = await db.select().from(tournamentCategories)
      .where(and(eq(tournamentCategories.id, categoryId), isNull(tournamentCategories.deletedAt)))
    if (!category) return reply.status(404).send({ error: 'Category not found', code: 'CATEGORY_NOT_FOUND' })
    const [tournament] = await db.select().from(tournaments)
      .where(and(eq(tournaments.id, category.tournamentId), isNull(tournaments.deletedAt)))
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    if (tournament.kind !== 'friendly') {
      return reply.status(409).send({ error: 'Jogadores avulsos só entram em torneio amistoso.', code: 'TOURNAMENT_NOT_FRIENDLY' })
    }
    if (!canEditRegistration(tournament.status)) {
      return reply.status(409).send({ error: 'O torneio não aceita mais inscrições (encerrado ou cancelado).', code: 'TOURNAMENT_LOCKED' })
    }

    const parsed = parseGuestList(text, category.discipline)
    if (parsed.errors.length || parsed.entries.length === 0) {
      const errors = parsed.errors.length ? parsed.errors : [{ line: 0, message: 'Cole ao menos um nome.' }]
      return reply.status(422).send({ error: 'A lista tem erros. Corrija as linhas indicadas.', code: 'GUEST_LIST_INVALID', details: { errors } })
    }

    try {
      const summary = await db.transaction(async (tx) => {
        // Lock da categoria: dois lotes simultâneos não passam juntos pelo limite de vagas nem repetem atleta.
        await tx.select({ id: tournamentCategories.id }).from(tournamentCategories).where(eq(tournamentCategories.id, categoryId)).for('update')
        // Avulsos são casados na tabela inteira de atletas: lotes de categorias diferentes (ou a planilha amistosa)
        // não podem criar o mesmo avulso duas vezes. Não há índice único possível por causa dos homônimos.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('athletes:guest'))`)

        // shortcut: lê todos os avulsos (poucos por federação); filtrar no SQL pelos nomes da lista se crescer.
        const candidates: GuestCandidate[] = (await tx.select({ id: athletes.id, name: athletes.name, gender: athletes.gender, birthYear: athletes.birthYear })
          .from(athletes)
          .where(and(eq(athletes.guest, true), isNull(athletes.deletedAt)))
          .orderBy(asc(athletes.createdAt), asc(athletes.id)))
        const taking = await selectRegistrations(
          and(eq(tournamentRegistrations.categoryId, categoryId), ne(tournamentRegistrations.status, 'rejected')),
          { executor: tx },
        )
        const taken = new Set(taking.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))
        let current = taking.length
        let created = 0
        let reused = 0
        const errors: GuestListError[] = []

        for (const entry of parsed.entries) {
          const ids: string[] = []
          for (const player of entry.players) {
            const found = matchGuest(candidates, player)
            if (found) {
              reused++
              // Completa o ano quando o avulso ainda não tinha (melhora o desempate da próxima vez).
              if (found.birthYear === null && player.birthYear !== null) {
                await tx.update(athletes).set({ birthYear: player.birthYear, updatedAt: new Date() }).where(eq(athletes.id, found.id))
                found.birthYear = player.birthYear
              }
              ids.push(found.id)
            } else {
              const id = randomUUID()
              await tx.insert(athletes).values({ id, name: player.name, gender: player.gender, birthYear: player.birthYear, guest: true })
              candidates.push({ id, name: player.name, gender: player.gender, birthYear: player.birthYear })
              created++
              ids.push(id)
            }
          }

          const problem = checkRegistrationEligibility({
            discipline: category.discipline,
            athletes: ids.map((id, i) => ({ id, gender: entry.players[i]!.gender, active: true })),
            takenAthleteIds: taken,
            maxEntries: category.maxEntries,
            currentEntries: current,
          })
          if (problem) {
            errors.push({ line: entry.line, message: problem.message })
            continue
          }
          ids.forEach((id) => taken.add(id))
          current++

          let athleteId: string | null = ids[0]!
          let pairId: string | null = null
          if (ids.length === 2) {
            const [first, second] = ids as [string, string]
            const existing = (await tx.select().from(pairs).where(and(
              eq(pairs.tenantId, tournament.tenantId),
              eq(pairs.discipline, category.discipline),
              isNull(pairs.deletedAt),
              or(and(eq(pairs.athlete1Id, first), eq(pairs.athlete2Id, second)), and(eq(pairs.athlete1Id, second), eq(pairs.athlete2Id, first))),
            )).orderBy(asc(pairs.createdAt), asc(pairs.id)).limit(1))[0]
            if (existing && !existing.active) {
              errors.push({ line: entry.line, message: 'A dupla está inativa. Reative-a em Duplas antes de inscrever.' })
              continue
            }
            pairId = existing?.id ?? (await tx.insert(pairs).values({
              id: randomUUID(), tenantId: tournament.tenantId, athlete1Id: first, athlete2Id: second, discipline: category.discipline,
            }).returning())[0]!.id
            athleteId = null
          }
          await tx.insert(tournamentRegistrations).values({ id: randomUUID(), categoryId, athleteId, pairId, status: 'approved' })
        }

        if (errors.length) throw new GuestBatchError(errors)
        return { registered: current - taking.length, athletesCreated: created, athletesReused: reused }
      })
      return reply.status(201).send(summary)
    } catch (err) {
      if (err instanceof GuestBatchError) {
        return reply.status(422).send({ error: 'A lista tem erros. Corrija as linhas indicadas.', code: 'GUEST_LIST_INVALID', details: { errors: err.errors } })
      }
      throw err
    }
  })
}
