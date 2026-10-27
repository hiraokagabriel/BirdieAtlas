import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { db } from './index.js'
import { athletes, draws, matches, tournamentCategories, tournamentRegistrations } from './schema.js'
import { selectRegistrations } from './registrations.js'

/** `db` ou uma transação. */
type Executor = Pick<typeof db, 'select'>

export type CategoryRow = typeof tournamentCategories.$inferSelect
export type MatchRow = typeof matches.$inferSelect

export interface TournamentMatches {
  categories: CategoryRow[]
  /** Categoria dona de cada chave ativa, por `drawId`. */
  categoryByDraw: Map<string, CategoryRow>
  matchRows: MatchRow[]
  /** Atletas de cada inscrição (um em simples, dois em duplas), inclusive de inscrições excluídas. */
  athletesByRegistrationId: Map<string, string[]>
  /** "Nome" ou "Nome / Nome" (duplas); `null` quando o lado da partida ainda não foi definido. */
  participantName: (registrationId: string | null) => string | null
}

/**
 * Partidas do torneio: uma chave por categoria, a mais antiga (a mesma que a aba Agenda e o
 * encerramento usam), com os nomes dos participantes. Só id e nome dos atletas: nada de e-mail,
 * CPF, telefone ou nascimento. Compartilhado pela agenda automática e pelos relatórios.
 */
export async function loadTournamentMatches(ex: Executor, tournamentId: string): Promise<TournamentMatches> {
  const categories = await ex.select().from(tournamentCategories)
    .where(and(eq(tournamentCategories.tournamentId, tournamentId), isNull(tournamentCategories.deletedAt)))
    .orderBy(asc(tournamentCategories.name), asc(tournamentCategories.id))
  const drawRows = categories.length
    ? await ex.select().from(draws).where(inArray(draws.categoryId, categories.map((c) => c.id))).orderBy(asc(draws.generatedAt), asc(draws.id))
    : []
  const drawByCategory = new Map<string, (typeof drawRows)[number]>()
  for (const draw of drawRows) if (!drawByCategory.has(draw.categoryId)) drawByCategory.set(draw.categoryId, draw)
  const activeDraws = [...drawByCategory.values()]

  const matchRows = activeDraws.length
    ? await ex.select().from(matches).where(inArray(matches.drawId, activeDraws.map((d) => d.id)))
    : []

  // Inclui inscrições excluídas: partidas antigas ainda as referenciam.
  const registrationIds = [...new Set(matchRows.flatMap((m) => [m.registration1Id, m.registration2Id]).filter((id): id is string => id !== null))]
  const registrations = registrationIds.length
    ? await selectRegistrations(inArray(tournamentRegistrations.id, registrationIds), { includeDeleted: true, executor: ex })
    : []
  const athletesByRegistrationId = new Map<string, string[]>(
    registrations.map((r) => [r.id, r.athlete2Id ? [r.athleteId, r.athlete2Id] : [r.athleteId]]),
  )
  const athleteIds = [...new Set([...athletesByRegistrationId.values()].flat())]
  const athleteRows = athleteIds.length
    ? await ex.select({ id: athletes.id, name: athletes.name }).from(athletes).where(inArray(athletes.id, athleteIds))
    : []
  const nameById = new Map(athleteRows.map((a) => [a.id, a.name]))

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const categoryByDraw = new Map(activeDraws.map((d) => [d.id, categoryById.get(d.categoryId)!]))

  const participantName = (registrationId: string | null): string | null => {
    if (!registrationId) return null
    const ids = athletesByRegistrationId.get(registrationId)
    if (!ids) return null
    return ids.map((id) => nameById.get(id) ?? '?').join(' / ')
  }

  return { categories, categoryByDraw, matchRows, athletesByRegistrationId, participantName }
}
