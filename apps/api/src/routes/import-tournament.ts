import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import {
  importIntoTournamentSchema, importTournamentSchema,
  type ImportIntoTournamentInput, type ImportIssue, type ImportReport, type ImportTournamentInput,
} from '@birdie-atlas/validators'
import { z } from 'zod'
import { db } from '../db/index.js'
import {
  athleteAffiliations, athletes, clubs, draws, pairs, tournamentCategories, tournamentRegistrations, tournaments,
} from '../db/schema.js'
import { checkRegistrationEligibility, isDoublesDiscipline, normalizePair } from '../domain/eligibility.js'
import {
  fold, personKey, toSlug, validateImportInput, type ExistingCategory, type Gender, type NormalizedEntry, type PersonRef,
} from '../domain/tournament-import.js'
import type { DrawFormat } from '../domain/placements.js'
import { getDefaultTenantId } from '../tenant.js'

// POST /import/tournament: cria um torneio inteiro (categorias, atletas, clubes, duplas e inscrições) a partir das
// linhas de uma planilha já lidas pelo navegador. POST /tournaments/:id/import: o mesmo, para dentro de um torneio
// já criado (só categorias e inscritos). `dryRun` (padrão) só valida e mostra o que seria criado.

/** Torneio de destino da importação para torneio existente, com o que já está inscrito nele. */
interface ExistingTarget {
  id: string
  name: string
  slug: string
  kind: 'official' | 'friendly'
  categories: ExistingCategory[]
  /** Atletas já inscritos (inscrição não recusada) por id de categoria. */
  takenByCategory: Map<string, Set<string>>
  /** Inscrições não recusadas por id de categoria. */
  countByCategory: Map<string, number>
  /** Estado lido na validação, para conferir de novo sob trava na gravação. */
  snapshot: Awaited<ReturnType<typeof readCategoryState>>
}

type Reader = Pick<typeof db, 'select'>

/** Inscritos (não recusados), contagem e chave sorteada das categorias. Fora e dentro da transação de gravação. */
async function readCategoryState(ex: Reader, categoryIds: string[]) {
  const takenByCategory = new Map<string, Set<string>>()
  const countByCategory = new Map<string, number>()
  if (categoryIds.length === 0) return { takenByCategory, countByCategory, drawn: new Set<string>() }
  const regs = await ex.select({ categoryId: tournamentRegistrations.categoryId, athleteId: tournamentRegistrations.athleteId, a1: pairs.athlete1Id, a2: pairs.athlete2Id })
    .from(tournamentRegistrations)
    .leftJoin(pairs, eq(pairs.id, tournamentRegistrations.pairId))
    .where(and(inArray(tournamentRegistrations.categoryId, categoryIds), isNull(tournamentRegistrations.deletedAt), ne(tournamentRegistrations.status, 'rejected')))
  for (const r of regs) {
    const set = takenByCategory.get(r.categoryId) ?? new Set<string>()
    for (const id of [r.athleteId, r.a1, r.a2]) if (id) set.add(id)
    takenByCategory.set(r.categoryId, set)
    countByCategory.set(r.categoryId, (countByCategory.get(r.categoryId) ?? 0) + 1)
  }
  // Categoria com chave sorteada não recebe inscrição nova (a chave não a veria).
  const drawn = new Set((await ex.select({ categoryId: draws.categoryId }).from(draws).where(inArray(draws.categoryId, categoryIds))).map((d) => d.categoryId))
  return { takenByCategory, countByCategory, drawn }
}

/** Retrato comparável do estado de uma categoria: se mudou entre a validação e a gravação, a importação para. */
function fingerprint(state: Awaited<ReturnType<typeof readCategoryState>>, id: string): string {
  return `${state.countByCategory.get(id) ?? 0}|${state.drawn.has(id)}|${[...(state.takenByCategory.get(id) ?? [])].sort().join(',')}`
}

/** Status em que o torneio ainda aceita inscrições pela planilha. */
const IMPORTABLE_STATUSES = new Set(['draft', 'registration_open', 'registration_closed'])

async function loadTarget(tournamentId: string, tenantId: string): Promise<ExistingTarget | { status: 404 | 409; error: string; code: string }> {
  const [t] = await db.select().from(tournaments)
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.tenantId, tenantId), isNull(tournaments.deletedAt)))
  if (!t) return { status: 404, error: 'Torneio não encontrado.', code: 'TOURNAMENT_NOT_FOUND' }
  if (!IMPORTABLE_STATUSES.has(t.status)) {
    return { status: 409, error: 'A planilha só entra em torneio em rascunho ou com inscrições abertas ou encerradas.', code: 'TOURNAMENT_LOCKED' }
  }
  const cats = await db.select().from(tournamentCategories)
    .where(and(eq(tournamentCategories.tournamentId, tournamentId), isNull(tournamentCategories.deletedAt)))
  const { takenByCategory, countByCategory, drawn } = await readCategoryState(db, cats.map((c) => c.id))
  return {
    id: t.id, name: t.name, slug: t.slug, kind: t.kind,
    categories: cats.map((c) => ({
      locked: drawn.has(c.id),
      id: c.id, name: c.name, discipline: c.discipline, drawType: c.drawType as DrawFormat, maxEntries: c.maxEntries,
      scoring: { pointsPerSet: c.pointsPerSet, setPointCap: c.setPointCap, setsToWin: c.setsToWin },
    })),
    takenByCategory,
    countByCategory,
    snapshot: { takenByCategory, countByCategory, drawn },
  }
}

interface ResolvedPerson {
  /** Id do atleta existente, ou null se será criado. */
  id: string | null
  /** Id temporário para a checagem de elegibilidade (único por pessoa). */
  ref: string
  ref_person: PersonRef
  gender: Gender
  active: boolean
}

const tournamentParamsSchema = z.object({ id: z.string().trim().min(1) })

export async function importTournamentRoutes(app: FastifyInstance) {
  app.post('/import/tournament', async (request, reply) => {
    const input = importTournamentSchema.parse(request.body)
    const result = await runImport(input, null, await getDefaultTenantId())
    return reply.status(result.status).send(result.body)
  })

  app.post('/tournaments/:id/import', async (request, reply) => {
    const { id } = tournamentParamsSchema.parse(request.params)
    const input = importIntoTournamentSchema.parse(request.body)
    const tenantId = await getDefaultTenantId()
    const target = await loadTarget(id, tenantId)
    if ('status' in target) return reply.status(target.status).send({ error: target.error, code: target.code })
    const result = await runImport(input, target, tenantId)
    return reply.status(result.status).send(result.body)
  })
}

async function runImport(
  input: ImportTournamentInput | ImportIntoTournamentInput,
  target: ExistingTarget | null,
  tenantId: string,
): Promise<{ status: number; body: unknown }> {
    const validated = validateImportInput(input, target?.categories)
    const errors: ImportIssue[] = [...validated.errors]
    const warnings: ImportIssue[] = [...validated.warnings]

    const report: ImportReport = {
      ok: false,
      dryRun: input.dryRun,
      errors,
      warnings,
      summary: {
        tournament: target
          ? { name: target.name, slug: target.slug, kind: target.kind }
          : { name: validated.tournament?.name ?? ('tournament' in input ? input.tournament.name : ''), slug: '', kind: validated.tournament?.kind ?? 'official' },
        categories: validated.categories.filter((c) => !c.existingId).length,
        ...(target ? { existingCategories: validated.categories.filter((c) => c.existingId).length } : {}),
        registrations: validated.entries.filter((e) => e.status !== 'rejected').length,
        athletes: { existing: 0, created: 0 },
        clubs: { existing: 0, created: 0 },
        pairs: { existing: 0, created: 0 },
      },
    }

    // ----- Endereço (slug) do torneio
    const existingSlugs = new Set(target ? [] : (await db.select({ slug: tournaments.slug }).from(tournaments).where(isNull(tournaments.deletedAt))).map((t) => t.slug))
    let slug = target?.slug ?? ''
    if (validated.tournament && !target) {
      if (validated.tournament.slug) {
        slug = validated.tournament.slug
        if (existingSlugs.has(slug)) errors.push({ sheet: 'Torneio', row: 0, field: 'Endereço (slug)', message: 'Já existe um torneio com esse endereço. Escolha outro.' })
      } else {
        const base = toSlug(validated.tournament.name) || 'torneio'
        slug = base
        for (let n = 2; existingSlugs.has(slug); n++) slug = `${base}-${n}`
      }
    }
    if (!target) report.summary.tournament.slug = slug

    // Amistoso: os jogadores são avulsos (ver "Avulsos" na especificação). O nome casa só com outro avulso, nunca
    // com atleta cadastrado; os novos nascem avulsos, sem clube nem filiação.
    const friendly = (target?.kind ?? validated.tournament?.kind) === 'friendly'

    // ----- Atletas e clubes existentes (carregados uma vez; a conferência de nomes ignora acento e caixa)
    const athleteRows = await db
      .select({ id: athletes.id, name: athletes.name, gender: athletes.gender, active: athletes.active, clubName: clubs.name })
      .from(athletes)
      .leftJoin(athleteAffiliations, and(
        eq(athleteAffiliations.athleteId, athletes.id),
        eq(athleteAffiliations.tenantId, tenantId),
        isNull(athleteAffiliations.endedAt),
      ))
      .leftJoin(clubs, eq(clubs.id, athleteAffiliations.clubId))
      // Amistoso: só avulsos desta federação (atleta não tem tenant; o avulso guarda a dele em guestTenantId).
      .where(and(isNull(athletes.deletedAt), eq(athletes.guest, friendly), friendly ? eq(athletes.guestTenantId, tenantId) : undefined))
      .orderBy(asc(athletes.createdAt), asc(athletes.id))
    const byName = new Map<string, typeof athleteRows>()
    for (const a of athleteRows) {
      byName.set(fold(a.name), [...(byName.get(fold(a.name)) ?? []), a])
    }
    const clubRows = await db.select({ id: clubs.id, name: clubs.name, slug: clubs.slug }).from(clubs)
      .where(and(eq(clubs.tenantId, tenantId), isNull(clubs.deletedAt)))
    const clubByName = new Map(clubRows.map((c) => [fold(c.name), c]))
    const takenClubSlugs = new Set((await db.select({ slug: clubs.slug }).from(clubs).where(isNull(clubs.deletedAt))).map((c) => c.slug))

    // ----- Resolve cada pessoa da planilha (uma vez por chave) para um atleta existente ou novo
    const people = new Map<string, { person: PersonRef; rows: number[] }>()
    const collect = (p: PersonRef | null, row: number) => {
      if (!p) return
      const key = personKey(p)
      const current = people.get(key)
      if (!current) people.set(key, { person: { ...p }, rows: [row] })
      else {
        current.rows.push(row)
        current.person.gender ??= p.gender
        current.person.club ??= p.club
      }
    }
    // Amistoso: o clube é ignorado, inclusive na chave da pessoa (mesmo nome = mesmo avulso, com ou sem clube).
    // Zera nas próprias entradas para todo `personKey` adiante (resolução, elegibilidade, gravação) bater.
    if (friendly) {
      for (const e of validated.entries) {
        e.athlete.club = null
        if (e.partner) e.partner.club = null
      }
    }
    for (const e of validated.entries) { collect(e.athlete, e.row); collect(e.partner, e.row) }

    const resolved = new Map<string, ResolvedPerson>()
    const newClubNames = new Map<string, string>() // fold -> nome como digitado
    for (const [key, { person, rows }] of people) {
      const at = (message: string, field = 'Atleta') => errors.push({ sheet: 'Inscritos', row: rows[0]!, field, message })
      let match: (typeof athleteRows)[number] | undefined

      const candidates = byName.get(fold(person.name)) ?? []
      // Avulso: mesmo nome e gênero é a mesma pessoa; entre homônimos, o mais antigo (regra de matchGuest, sem ano
      // na planilha). Gênero diferente cria outro avulso; sem gênero, o nome decide (e o gênero vem do avulso).
      const guestPool = friendly && person.gender ? candidates.filter((c) => c.gender === person.gender) : candidates
      if (friendly && guestPool.length > 0) {
        match = guestPool[0]
      } else if (friendly && candidates.length > 0) {
        // Há avulso com o nome, mas de outro gênero: cai na criação abaixo.
      } else if (candidates.length === 1) {
        match = candidates[0]
        // Sem e-mail, nome único é a mesma pessoa; o clube diferente só é avisado (pode ter trocado de clube).
        if (match && person.club && match.clubName && fold(match.clubName) !== fold(person.club)) {
          warnings.push({ sheet: 'Inscritos', row: rows[0]!, field: 'Clube', message: `${person.name} já está cadastrado(a) no clube ${match.clubName}; a planilha diz ${person.club}. Usei o cadastro existente.` })
        }
      } else if (candidates.length > 1) {
        const narrowed = person.club ? candidates.filter((c) => c.clubName && fold(c.clubName) === fold(person.club)) : []
        if (narrowed.length === 1) match = narrowed[0]
        else if (narrowed.length > 1) {
          at(`Há ${narrowed.length} atletas chamados "${person.name}" no clube ${person.club}. Diferencie o nome no cadastro antes de importar.`)
          continue
        } else {
          const clubsSeen = [...new Set(candidates.map((c) => c.clubName ?? 'sem clube'))].join(', ')
          at(`Há ${candidates.length} atletas chamados "${person.name}" (${clubsSeen}). Informe o clube para eu saber qual é.`)
          continue
        }
      }

      if (match) {
        if (person.gender && person.gender !== match.gender) {
          at(`${person.name}: o sexo da planilha ou da modalidade (${person.gender}) diverge do cadastro (${match.gender}).`, 'Sexo')
          continue
        }
        resolved.set(key, { id: match.id, ref: match.id, ref_person: person, gender: match.gender, active: match.active })
        report.summary.athletes.existing++
        continue
      }

      if (!person.gender) {
        at(`${person.name} não está cadastrado(a): informe o sexo (M ou F) para criar o atleta.`, 'Sexo')
        continue
      }
      resolved.set(key, { id: null, ref: `novo:${key}`, ref_person: person, gender: person.gender, active: true })
      report.summary.athletes.created++
      if (person.club && !friendly) {
        const clubKey = fold(person.club)
        if (clubByName.has(clubKey)) { /* clube existente */ } else if (!newClubNames.has(clubKey)) newClubNames.set(clubKey, person.club)
      }
    }
    report.summary.clubs.created = newClubNames.size
    report.summary.clubs.existing = new Set(
      [...resolved.values()].flatMap((r) => (!friendly && r.ref_person.club && clubByName.has(fold(r.ref_person.club)) ? [fold(r.ref_person.club)] : [])),
    ).size

    // ----- Elegibilidade (gênero da disciplina, inativo, repetido, vagas), categoria a categoria
    // Torneio existente: quem já está inscrito ocupa a vaga e não pode entrar de novo na mesma categoria.
    const taken = new Map<string, Set<string>>()
    const counts = new Map<string, number>()
    for (const c of validated.categories) {
      if (!c.existingId || !target) continue
      taken.set(c.key, new Set(target.takenByCategory.get(c.existingId) ?? []))
      counts.set(c.key, target.countByCategory.get(c.existingId) ?? 0)
    }
    for (const entry of validated.entries) {
      const a = resolved.get(personKey(entry.athlete))
      const p = entry.partner ? resolved.get(personKey(entry.partner)) : null
      if (!a || (entry.partner && !p)) continue // erro de resolução já registrado
      if (entry.status === 'rejected') continue
      const participants = [a, ...(p ? [p] : [])].map((x) => ({ id: x.ref, gender: x.gender, active: x.active }))
      const set = taken.get(entry.category.key) ?? new Set<string>()
      const problem = checkRegistrationEligibility({
        discipline: entry.category.discipline,
        athletes: participants,
        takenAthleteIds: set,
        maxEntries: entry.category.maxEntries,
        currentEntries: counts.get(entry.category.key) ?? 0,
      })
      if (problem) {
        errors.push({ sheet: 'Inscritos', row: entry.row, field: 'Atleta', message: problem.message })
        continue
      }
      participants.forEach((x) => set.add(x.id))
      taken.set(entry.category.key, set)
      counts.set(entry.category.key, (counts.get(entry.category.key) ?? 0) + 1)
    }

    // ----- Duplas (existentes ou novas)
    const existingPairs = await db.select().from(pairs).where(and(eq(pairs.tenantId, tenantId), isNull(pairs.deletedAt)))
    const pairKeyOf = (a: string, b: string, discipline: string) => `${normalizePair(a, b).join('|')}|${discipline}`
    const pairByKey = new Map(existingPairs.map((p) => [pairKeyOf(p.athlete1Id, p.athlete2Id, p.discipline), p]))
    const doublesEntries = validated.entries.filter((e) => isDoublesDiscipline(e.category.discipline))
    const newPairKeys = new Set<string>()
    const usedExistingPairs = new Set<string>()
    for (const e of doublesEntries) {
      const a = resolved.get(personKey(e.athlete))
      const p = e.partner ? resolved.get(personKey(e.partner)) : null
      if (!a || !p) continue
      const k = pairKeyOf(a.ref, p.ref, e.category.discipline)
      const found = a.id && p.id ? pairByKey.get(pairKeyOf(a.id, p.id, e.category.discipline)) : undefined
      if (found) {
        if (!found.active) errors.push({ sheet: 'Inscritos', row: e.row, field: 'Parceiro(a)', message: 'A dupla está inativa. Reative-a em Duplas antes de importar.' })
        else usedExistingPairs.add(found.id)
      } else newPairKeys.add(k)
    }
    report.summary.pairs = { existing: usedExistingPairs.size, created: newPairKeys.size }

    report.ok = errors.length === 0
    if (!report.ok || input.dryRun) {
      if (!report.ok && !input.dryRun) {
        return { status: 422, body: { error: 'A planilha tem erros. Corrija e tente de novo.', code: 'IMPORT_INVALID', details: report } }
      }
      return { status: 200, body: report }
    }

    // ----- Grava tudo numa transação
    const tournamentId = target?.id ?? randomUUID()
    try {
    await db.transaction(async (tx) => {
      // Mesmo lock da lista colada: lotes simultâneos não criam o mesmo avulso duas vezes.
      if (friendly) await tx.execute(sql`select pg_advisory_xact_lock(hashtext('athletes:guest'))`)
      const clubIdByKey = new Map(clubRows.map((c) => [fold(c.name), c.id]))
      for (const [key, name] of newClubNames) {
        const base = toSlug(name) || 'clube'
        let clubSlug = base
        for (let n = 2; takenClubSlugs.has(clubSlug); n++) clubSlug = `${base}-${n}`
        takenClubSlugs.add(clubSlug)
        const id = randomUUID()
        await tx.insert(clubs).values({ id, tenantId, name, slug: clubSlug })
        clubIdByKey.set(key, id)
      }

      const today = new Date().toISOString().slice(0, 10)
      const athleteIdByRef = new Map<string, string>()
      for (const person of resolved.values()) {
        if (person.id) { athleteIdByRef.set(person.ref, person.id); continue }
        const id = randomUUID()
        await tx.insert(athletes).values({
          id, name: person.ref_person.name, gender: person.gender, nationality: 'BR', active: true, guest: friendly,
          ...(friendly ? { guestTenantId: tenantId } : {}),
        })
        athleteIdByRef.set(person.ref, id)
        const clubId = person.ref_person.club && !friendly ? clubIdByKey.get(fold(person.ref_person.club)) : undefined
        if (clubId) await tx.insert(athleteAffiliations).values({ id: randomUUID(), athleteId: id, clubId, tenantId, startedAt: today })
      }

      if (!target) {
        const t = validated.tournament!
        await tx.insert(tournaments).values({
          id: tournamentId, tenantId, status: 'draft', name: t.name, slug, kind: t.kind, level: t.level,
          startDate: t.startDate, endDate: t.endDate, city: t.city, state: t.state, location: t.location,
        })
      } else {
        // Trava o torneio: o status não muda (ex.: iniciar) enquanto as inscrições entram.
        const [locked] = await tx.select({ status: tournaments.status }).from(tournaments)
          .where(and(eq(tournaments.id, tournamentId), eq(tournaments.tenantId, tenantId), isNull(tournaments.deletedAt))).for('update')
        if (!locked || !IMPORTABLE_STATUSES.has(locked.status)) throw new ImportConflict()
        // As categorias que recebem inscrições ficam travadas (a mesma trava da inscrição pela tela e do sorteio), em
        // ordem de id; se algo mudou nelas desde a verificação, nada é gravado.
        const receiving = [...new Set(validated.categories.flatMap((c) => (c.existingId ? [c.existingId] : [])))].sort()
        if (receiving.length) {
          await tx.select({ id: tournamentCategories.id }).from(tournamentCategories)
            .where(inArray(tournamentCategories.id, receiving)).orderBy(asc(tournamentCategories.id)).for('update')
          const now = await readCategoryState(tx, receiving)
          if (receiving.some((id) => fingerprint(now, id) !== fingerprint(target.snapshot, id))) throw new ImportConflict()
        }
      }
      const categoryIdByKey = new Map<string, string>()
      for (const c of validated.categories) {
        if (c.existingId) { categoryIdByKey.set(c.key, c.existingId); continue }
        const id = randomUUID()
        categoryIdByKey.set(c.key, id)
        await tx.insert(tournamentCategories).values({
          id, tournamentId, name: c.name, discipline: c.discipline, drawType: c.drawType, maxEntries: c.maxEntries,
          pointsPerSet: c.scoring.pointsPerSet, setPointCap: c.scoring.setPointCap, setsToWin: c.scoring.setsToWin,
        })
      }

      const pairIdByKey = new Map<string, string>()
      const pairFor = async (e: NormalizedEntry, aId: string, bId: string): Promise<string> => {
        const k = pairKeyOf(aId, bId, e.category.discipline)
        const cached = pairIdByKey.get(k) ?? pairByKey.get(k)?.id
        if (cached) return cached
        const [first, second] = normalizePair(aId, bId)
        const id = randomUUID()
        await tx.insert(pairs).values({ id, tenantId, athlete1Id: first, athlete2Id: second, discipline: e.category.discipline })
        pairIdByKey.set(k, id)
        return id
      }

      for (const e of validated.entries) {
        const a = athleteIdByRef.get(resolved.get(personKey(e.athlete))!.ref)!
        const categoryId = categoryIdByKey.get(e.category.key)!
        let athleteId: string | null = a
        let pairId: string | null = null
        if (e.partner) {
          const b = athleteIdByRef.get(resolved.get(personKey(e.partner))!.ref)!
          pairId = await pairFor(e, a, b)
          athleteId = null
        }
        await tx.insert(tournamentRegistrations).values({
          id: randomUUID(), categoryId, athleteId, pairId, seed: e.seed, status: e.status,
        })
      }
    })
    } catch (err) {
      if (err instanceof ImportConflict) return { status: 409, body: { error: 'O torneio ou as inscrições mudaram durante a importação. Verifique a planilha de novo.', code: 'IMPORT_STALE' } }
      // Segunda barreira: índice único de inscrição (o mesmo atleta entrou por outro caminho ao mesmo tempo).
      const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code
      if (code === '23505') return { status: 409, body: { error: 'Alguém foi inscrito na mesma categoria durante a importação. Verifique a planilha de novo.', code: 'IMPORT_STALE' } }
      throw err
    }

    report.tournamentId = tournamentId
    return { status: 201, body: report }
}

/** O torneio mudou de status entre a verificação e a gravação. */
class ImportConflict extends Error {}
