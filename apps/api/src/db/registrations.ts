import { and, asc, count, eq, inArray, isNull, type SQL } from 'drizzle-orm'
import { db } from './index.js'
import { athleteAffiliations, athletes, clubs, pairs, tournamentCategories, tournamentRegistrations } from './schema.js'

type RegistrationRow = typeof tournamentRegistrations.$inferSelect
/** `db` ou uma transação (ex.: ler dentro do lock da categoria). */
type Executor = Pick<typeof db, 'select'>

/**
 * Inscrição com os atletas já resolvidos. A tabela guarda `athleteId` (simples) XOR `pairId` (duplas);
 * quem consome não deve ler essas colunas direto, e sim estes campos:
 * - `athleteId` / `athlete2Id`: o atleta de simples, ou os dois atletas da dupla (athlete2Id é null em simples)
 * - `tournamentId` / `discipline`: da categoria da inscrição
 */
export type ResolvedRegistration = Omit<RegistrationRow, 'athleteId'> & {
  athleteId: string
  athlete2Id: string | null
  tournamentId: string
  discipline: typeof tournamentCategories.$inferSelect.discipline
}

export interface RegistrationQueryOptions {
  /** Consultas por id vindas de partidas e rankings precisam enxergar inscrições excluídas: o histórico não some. */
  includeDeleted?: boolean
  limit?: number
  offset?: number
  executor?: Executor
}

function whereClause(where: SQL | undefined, options: RegistrationQueryOptions) {
  return and(where, options.includeDeleted ? undefined : isNull(tournamentRegistrations.deletedAt))
}

/** `where` pode referenciar `tournamentRegistrations`, `tournamentCategories` e `pairs`. */
export async function selectRegistrations(where?: SQL, options: RegistrationQueryOptions = {}): Promise<ResolvedRegistration[]> {
  const query = (options.executor ?? db)
    .select({
      registration: tournamentRegistrations,
      tournamentId: tournamentCategories.tournamentId,
      discipline: tournamentCategories.discipline,
      pair: { athlete1Id: pairs.athlete1Id, athlete2Id: pairs.athlete2Id },
    })
    .from(tournamentRegistrations)
    .innerJoin(tournamentCategories, eq(tournamentCategories.id, tournamentRegistrations.categoryId))
    .leftJoin(pairs, eq(pairs.id, tournamentRegistrations.pairId))
    .where(whereClause(where, options))
    .orderBy(asc(tournamentRegistrations.createdAt), asc(tournamentRegistrations.id))
    .$dynamic()

  const rows = await (options.limit !== undefined ? query.limit(options.limit).offset(options.offset ?? 0) : query)

  return rows.map(({ registration, tournamentId, discipline, pair }) => {
    const athleteId = registration.athleteId ?? pair?.athlete1Id
    if (!athleteId) {
      throw new Error(`Inscrição ${registration.id} sem atleta nem dupla (viola registrations_athlete_xor_pair).`)
    }
    return { ...registration, athleteId, athlete2Id: pair?.athlete2Id ?? null, tournamentId, discipline }
  })
}

export async function countRegistrations(where?: SQL, options: RegistrationQueryOptions = {}): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(tournamentRegistrations)
    .innerJoin(tournamentCategories, eq(tournamentCategories.id, tournamentRegistrations.categoryId))
    .leftJoin(pairs, eq(pairs.id, tournamentRegistrations.pairId))
    .where(whereClause(where, options))
  return row?.total ?? 0
}

/** Clube atual (afiliação sem data de término) de cada atleta; com duas ativas, vale a de início mais recente. */
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

/** Nome de cada atleta, por id. */
export async function athleteNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const rows = await db.select({ id: athletes.id, name: athletes.name }).from(athletes).where(inArray(athletes.id, ids))
  return new Map(rows.map((a) => [a.id, a.name]))
}
