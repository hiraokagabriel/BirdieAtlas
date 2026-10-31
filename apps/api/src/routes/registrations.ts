import type { FastifyInstance } from 'fastify'
import { and, asc, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import {
  approveRegistrationBodySchema,
  registerBodySchema,
  registrationIdParamsSchema,
  tournamentRegistrationsParamsSchema,
  tournamentRegistrationsQuerySchema,
  updateRegistrationBodySchema,
  type RegistrationResponse,
  type RegistrationStatus,
} from '@birdie-atlas/validators'
import { db } from '../db/index.js'
import { countRegistrations, selectRegistrations, type ResolvedRegistration } from '../db/registrations.js'
import {
  athleteAffiliations, athletes, clubs, matches, pairs, tournamentCategories, tournamentRegistrations, tournaments,
} from '../db/schema.js'
import { buildCsv, csvAttachmentHeader } from '../domain/csv.js'
import { checkRegistrationEligibility } from '../domain/eligibility.js'
import { paginate } from '../domain/pagination.js'
import { canEditRegistration, validateRegistrationStatusChange } from '../domain/registration-rules.js'

export async function athleteNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const rows = await db.select({ id: athletes.id, name: athletes.name }).from(athletes).where(inArray(athletes.id, ids))
  return new Map(rows.map((a) => [a.id, a.name]))
}

/** Clube atual (afiliação sem data de término) de cada atleta. */
export async function currentClubNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const rows = await db
    .select({ athleteId: athleteAffiliations.athleteId, clubName: clubs.name })
    .from(athleteAffiliations)
    .innerJoin(clubs, eq(clubs.id, athleteAffiliations.clubId))
    .where(and(inArray(athleteAffiliations.athleteId, ids), isNull(athleteAffiliations.endedAt)))
    .orderBy(asc(athleteAffiliations.startedAt))
  return new Map(rows.map((r) => [r.athleteId, r.clubName]))
}

const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Recusada',
}

async function namesFor(regs: ResolvedRegistration[]): Promise<Map<string, string>> {
  return athleteNames([...new Set(regs.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))])
}

function toResponse(reg: ResolvedRegistration, names: Map<string, string>): RegistrationResponse {
  return {
    id: reg.id,
    tournamentId: reg.tournamentId,
    categoryId: reg.categoryId,
    pairId: reg.pairId,
    athleteId: reg.athleteId,
    athlete2Id: reg.athlete2Id,
    athleteName: names.get(reg.athleteId) ?? null,
    athlete2Name: reg.athlete2Id ? (names.get(reg.athlete2Id) ?? null) : null,
    seed: reg.seed,
    status: reg.status,
    notes: reg.notes,
    createdAt: reg.createdAt.toISOString(),
    updatedAt: reg.updatedAt.toISOString(),
  }
}

type TxResult = { ok: true; id: string } | { ok: false; error: { code: string; message: string } }

async function isInDraw(registrationId: string): Promise<boolean> {
  const [row] = await db.select({ id: matches.id }).from(matches)
    .where(or(eq(matches.registration1Id, registrationId), eq(matches.registration2Id, registrationId)))
    .limit(1)
  return row !== undefined
}

async function loadTournament(id: string) {
  const [tournament] = await db.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
  return tournament
}

export async function registrationsRoutes(app: FastifyInstance) {
  // Público: quem está na disputa. Recusadas ficam de fora e `notes` (motivo interno) nunca sai daqui.
  app.get('/tournaments/categories/:categoryId/registrations', async (request) => {
    const { categoryId } = request.params as { categoryId: string }
    const regs = await selectRegistrations(
      and(eq(tournamentRegistrations.categoryId, categoryId), ne(tournamentRegistrations.status, 'rejected')),
    )
    const names = await namesFor(regs)
    return regs.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      pairId: r.pairId,
      athleteId: r.athleteId,
      athlete2Id: r.athlete2Id,
      athleteName: names.get(r.athleteId) ?? null,
      athlete2Name: r.athlete2Id ? (names.get(r.athlete2Id) ?? null) : null,
      seed: r.seed,
      status: r.status,
      rankingPointsAtEntry: r.rankingPointsAtEntry,
      // Colocação final (só preenchida quando o torneio é encerrado): alimenta o pódio público.
      finalPlacement: r.finalPlacement,
    }))
  })

  // Admin (ADMIN_ONLY_READS): inscritos por categoria em CSV. Só nome, clube, categoria e status:
  // sem e-mail, data de nascimento nem o motivo interno (`notes`).
  app.get('/tournaments/:id/registrations/export.csv', async (request, reply) => {
    const { tournamentId: id } = tournamentRegistrationsParamsSchema.parse({ tournamentId: (request.params as { id: string }).id })
    const tournament = await loadTournament(id)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })

    const categories = await db.select().from(tournamentCategories)
      .where(and(eq(tournamentCategories.tournamentId, id), isNull(tournamentCategories.deletedAt)))
      .orderBy(asc(tournamentCategories.name), asc(tournamentCategories.id))
    const regs = await selectRegistrations(eq(tournamentCategories.tournamentId, id))
    const names = await namesFor(regs)
    const clubNames = await currentClubNames([...names.keys()])

    const rows = categories.flatMap((category) =>
      regs
        .filter((r) => r.categoryId === category.id)
        .map((r) => {
          const athleteIds = [r.athleteId, r.athlete2Id].filter((v): v is string => v !== null)
          const clubList = [...new Set(athleteIds.map((athleteId) => clubNames.get(athleteId)).filter((v): v is string => !!v))]
          return [
            category.name,
            names.get(r.athleteId) ?? '',
            r.athlete2Id ? (names.get(r.athlete2Id) ?? '') : '',
            clubList.join(' / '),
            r.seed,
            REGISTRATION_STATUS_LABELS[r.status],
          ]
        }),
    )

    const csv = buildCsv(['Categoria', 'Atleta', 'Parceiro(a)', 'Clube', 'Cabeça de chave', 'Status'], rows)
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', csvAttachmentHeader(`${tournament.slug}-inscritos`))
      .header('Cache-Control', 'no-store')
      .send(csv)
  })

  // Admin: todas as inscrições do torneio (inclusive recusadas e com motivo), paginadas.
  app.get('/registrations/tournament/:tournamentId', async (request, reply) => {
    const { tournamentId } = tournamentRegistrationsParamsSchema.parse(request.params)
    const query = tournamentRegistrationsQuerySchema.parse(request.query)
    if (!(await loadTournament(tournamentId))) {
      return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    }

    const where = and(
      eq(tournamentCategories.tournamentId, tournamentId),
      query.status ? eq(tournamentRegistrations.status, query.status) : undefined,
      query.categoryId ? eq(tournamentRegistrations.categoryId, query.categoryId) : undefined,
    )
    return paginate(
      query,
      async (limit, offset) => {
        const regs = await selectRegistrations(where, { limit, offset })
        const names = await namesFor(regs)
        return regs.map((r) => toResponse(r, names))
      },
      () => countRegistrations(where),
    )
  })

  app.post('/tournaments/categories/:categoryId/register', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const body = registerBodySchema.parse(request.body)

    const [category] = await db.select().from(tournamentCategories)
      .where(and(eq(tournamentCategories.id, categoryId), isNull(tournamentCategories.deletedAt)))
    if (!category) return reply.status(404).send({ error: 'Category not found', code: 'CATEGORY_NOT_FOUND' })

    const tournament = await loadTournament(category.tournamentId)
    if (!tournament) return reply.status(404).send({ error: 'Tournament not found', code: 'TOURNAMENT_NOT_FOUND' })
    if (!canEditRegistration(tournament.status)) {
      return reply.status(409).send({ error: 'O torneio não aceita mais inscrições (encerrado ou cancelado).', code: 'TOURNAMENT_LOCKED' })
    }

    // Quem participa: os dois atletas da dupla informada, ou os atletas do corpo.
    let participantIds: string[]
    let existingPair: typeof pairs.$inferSelect | undefined
    if (body.pairId) {
      ;[existingPair] = await db.select().from(pairs).where(and(eq(pairs.id, body.pairId), isNull(pairs.deletedAt)))
      if (!existingPair) return reply.status(404).send({ error: 'Pair not found', code: 'PAIR_NOT_FOUND' })
      participantIds = [existingPair.athlete1Id, existingPair.athlete2Id]
    } else {
      participantIds = [body.athleteId, body.athlete2Id].filter((id): id is string => id !== undefined)
    }

    const athleteRows = await db.select({ id: athletes.id, gender: athletes.gender, active: athletes.active }).from(athletes)
      .where(and(inArray(athletes.id, participantIds), isNull(athletes.deletedAt)))
    if (athleteRows.length !== new Set(participantIds).size) {
      return reply.status(404).send({ error: 'Atleta não encontrado.', code: 'ATHLETE_NOT_FOUND' })
    }
    const participants = participantIds.map((id) => athleteRows.find((a) => a.id === id)!)

    // Tudo que depende do estado da categoria roda sob o lock dela: duas inscrições simultâneas
    // não passam juntas pelo limite de vagas nem inscrevem o mesmo atleta (sozinho e em dupla).
    const result = await db.transaction(async (tx): Promise<TxResult> => {
      await tx.select({ id: tournamentCategories.id }).from(tournamentCategories)
        .where(eq(tournamentCategories.id, categoryId)).for('update')

      const taking = await selectRegistrations(
        and(eq(tournamentRegistrations.categoryId, categoryId), ne(tournamentRegistrations.status, 'rejected')),
        { executor: tx },
      )
      const eligibility = checkRegistrationEligibility({
        discipline: category.discipline,
        athletes: participants,
        takenAthleteIds: new Set(taking.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[])),
        maxEntries: category.maxEntries,
        currentEntries: taking.length,
      })
      if (eligibility) return { ok: false, error: eligibility }

      let athleteId: string | null = null
      let pairId: string | null = null
      if (participants.length === 2) {
        const [first, second] = participantIds as [string, string]
        const pair = existingPair ?? (await tx.select().from(pairs).where(and(
          eq(pairs.tenantId, tournament.tenantId),
          eq(pairs.discipline, category.discipline),
          isNull(pairs.deletedAt),
          or(
            and(eq(pairs.athlete1Id, first), eq(pairs.athlete2Id, second)),
            and(eq(pairs.athlete1Id, second), eq(pairs.athlete2Id, first)),
          ),
        )).orderBy(asc(pairs.createdAt), asc(pairs.id)).limit(1))[0]

        if (pair && pair.discipline !== category.discipline) return { ok: false, error: { code: 'PAIR_DISCIPLINE_MISMATCH', message: 'A dupla é de outra disciplina.' } }
        if (pair && !pair.active) return { ok: false, error: { code: 'PAIR_INACTIVE', message: 'A dupla está inativa. Reative-a em Duplas antes de inscrever.' } }

        pairId = pair?.id ?? (await tx.insert(pairs).values({
          id: randomUUID(), tenantId: tournament.tenantId, athlete1Id: first, athlete2Id: second, discipline: category.discipline,
        }).returning())[0]!.id
      } else {
        athleteId = participantIds[0]!
      }

      const [created] = await tx.insert(tournamentRegistrations).values({
        id: randomUUID(), categoryId, athleteId, pairId, seed: body.seed, status: 'pending',
      }).returning()
      return { ok: true, id: created!.id }
    })

    if (!result.ok) {
      const status = result.error.code === 'ATHLETE_ALREADY_REGISTERED' || result.error.code === 'CATEGORY_FULL' || result.error.code === 'PAIR_INACTIVE' ? 409 : 422
      return reply.status(status).send({ error: result.error.message, code: result.error.code })
    }

    const [reg] = await selectRegistrations(eq(tournamentRegistrations.id, result.id))
    return reply.status(201).send(toResponse(reg!, await namesFor([reg!])))
  })

  app.patch('/registrations/:registrationId', async (request, reply) => {
    const { registrationId } = registrationIdParamsSchema.parse(request.params)
    const body = updateRegistrationBodySchema.parse(request.body)

    const [current] = await selectRegistrations(eq(tournamentRegistrations.id, registrationId))
    if (!current) return reply.status(404).send({ error: 'Registration not found', code: 'REGISTRATION_NOT_FOUND' })

    const tournament = await loadTournament(current.tournamentId)
    if (!tournament || !canEditRegistration(tournament.status)) {
      return reply.status(409).send({ error: 'O torneio não permite mais alterações.', code: 'TOURNAMENT_LOCKED' })
    }

    const changesStatus = body.status !== undefined && body.status !== current.status
    if (changesStatus) {
      const transitionError = validateRegistrationStatusChange(current.status, body.status!, body.notes)
      if (transitionError) return reply.status(422).send({ error: transitionError, code: 'INVALID_REGISTRATION_TRANSITION' })
    }

    const changesCategory = body.categoryId !== undefined && body.categoryId !== current.categoryId
    if (changesCategory) {
      const [target] = await db.select().from(tournamentCategories)
        .where(and(eq(tournamentCategories.id, body.categoryId!), isNull(tournamentCategories.deletedAt)))
      if (!target || target.tournamentId !== current.tournamentId || target.discipline !== current.discipline) {
        return reply.status(422).send({ error: 'A categoria precisa ser do mesmo torneio e da mesma disciplina.', code: 'INVALID_REGISTRATION_CATEGORY' })
      }
    }

    // Quem já está numa chave só pode ser recusado ou movido depois de refazer a chave.
    if ((changesCategory || (changesStatus && body.status !== 'approved')) && (await isInDraw(registrationId))) {
      return reply.status(409).send({ error: 'A inscrição já está em uma chave. Refaça ou remova a chave antes.', code: 'REGISTRATION_IN_DRAW' })
    }

    await db.update(tournamentRegistrations).set({
      ...(changesCategory ? { categoryId: body.categoryId } : {}),
      ...(changesStatus ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      updatedAt: new Date(),
    }).where(eq(tournamentRegistrations.id, registrationId))

    const [updated] = await selectRegistrations(eq(tournamentRegistrations.id, registrationId))
    return toResponse(updated!, await namesFor([updated!]))
  })

  // Idempotente: aprovar uma inscrição já aprovada devolve a inscrição como está.
  app.post('/registrations/:registrationId/approve', async (request, reply) => {
    const { registrationId } = registrationIdParamsSchema.parse(request.params)
    const body = approveRegistrationBodySchema.parse(request.body ?? {})

    const [current] = await selectRegistrations(eq(tournamentRegistrations.id, registrationId))
    if (!current) return reply.status(404).send({ error: 'Registration not found', code: 'REGISTRATION_NOT_FOUND' })

    const tournament = await loadTournament(current.tournamentId)
    if (!tournament || !canEditRegistration(tournament.status)) {
      return reply.status(409).send({ error: 'O torneio não permite mais alterações.', code: 'TOURNAMENT_LOCKED' })
    }

    if (current.status !== 'approved') {
      const transitionError = validateRegistrationStatusChange(current.status, 'approved', body.notes)
      if (transitionError) return reply.status(422).send({ error: transitionError, code: 'INVALID_REGISTRATION_TRANSITION' })
      await db.update(tournamentRegistrations)
        .set({ status: 'approved', notes: body.notes ?? null, updatedAt: new Date() })
        .where(eq(tournamentRegistrations.id, registrationId))
    }

    const [approved] = await selectRegistrations(eq(tournamentRegistrations.id, registrationId))
    return toResponse(approved!, await namesFor([approved!]))
  })

  app.delete('/tournaments/registrations/:registrationId', async (request, reply) => {
    const { registrationId } = request.params as { registrationId: string }
    const [current] = await selectRegistrations(eq(tournamentRegistrations.id, registrationId))
    if (!current) return reply.status(404).send({ error: 'Registration not found', code: 'REGISTRATION_NOT_FOUND' })

    const tournament = await loadTournament(current.tournamentId)
    if (!tournament || !canEditRegistration(tournament.status)) {
      return reply.status(409).send({ error: 'O torneio não permite mais alterações.', code: 'TOURNAMENT_LOCKED' })
    }
    if (await isInDraw(registrationId)) {
      return reply.status(409).send({ error: 'A inscrição já está em uma chave. Refaça ou remova a chave antes.', code: 'REGISTRATION_IN_DRAW' })
    }

    await db.update(tournamentRegistrations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tournamentRegistrations.id, registrationId))
    return reply.status(204).send()
  })
}
