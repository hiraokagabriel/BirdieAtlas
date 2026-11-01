import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { importTournamentSchema, type ImportIssue, type ImportReport } from '@birdie-atlas/validators'
import { db } from '../db/index.js'
import {
  athleteAffiliations, athletes, clubs, pairs, tournamentCategories, tournamentRegistrations, tournaments,
} from '../db/schema.js'
import { checkRegistrationEligibility, isDoublesDiscipline, normalizePair } from '../domain/eligibility.js'
import {
  fold, personKey, toSlug, validateImportInput, type Gender, type NormalizedEntry, type PersonRef,
} from '../domain/tournament-import.js'
import { getDefaultTenantId } from '../tenant.js'

// POST /import/tournament: cria um torneio inteiro (categorias, atletas, clubes, duplas e inscrições) a partir das
// linhas de uma planilha já lidas pelo navegador. `dryRun` (padrão) só valida e mostra o que seria criado.

interface ResolvedPerson {
  /** Id do atleta existente, ou null se será criado. */
  id: string | null
  /** Id temporário para a checagem de elegibilidade (único por pessoa). */
  ref: string
  ref_person: PersonRef
  gender: Gender
  active: boolean
}

export async function importTournamentRoutes(app: FastifyInstance) {
  app.post('/import/tournament', async (request, reply) => {
    const input = importTournamentSchema.parse(request.body)
    const validated = validateImportInput(input)
    const errors: ImportIssue[] = [...validated.errors]
    const warnings: ImportIssue[] = [...validated.warnings]
    const tenantId = await getDefaultTenantId()

    const report: ImportReport = {
      ok: false,
      dryRun: input.dryRun,
      errors,
      warnings,
      summary: {
        tournament: { name: validated.tournament?.name ?? input.tournament.name, slug: '', kind: validated.tournament?.kind ?? 'official' },
        categories: validated.categories.length,
        registrations: validated.entries.filter((e) => e.status !== 'rejected').length,
        athletes: { existing: 0, created: 0 },
        clubs: { existing: 0, created: 0 },
        pairs: { existing: 0, created: 0 },
      },
    }

    // ----- Endereço (slug) do torneio
    const existingSlugs = new Set((await db.select({ slug: tournaments.slug }).from(tournaments).where(isNull(tournaments.deletedAt))).map((t) => t.slug))
    let slug = ''
    if (validated.tournament) {
      if (validated.tournament.slug) {
        slug = validated.tournament.slug
        if (existingSlugs.has(slug)) errors.push({ sheet: 'Torneio', row: 0, field: 'Endereço (slug)', message: 'Já existe um torneio com esse endereço. Escolha outro.' })
      } else {
        const base = toSlug(validated.tournament.name) || 'torneio'
        slug = base
        for (let n = 2; existingSlugs.has(slug); n++) slug = `${base}-${n}`
      }
    }
    report.summary.tournament.slug = slug

    // ----- Atletas e clubes existentes (carregados uma vez; a conferência de nomes ignora acento e caixa)
    const athleteRows = await db
      .select({ id: athletes.id, name: athletes.name, email: athletes.email, gender: athletes.gender, active: athletes.active, clubName: clubs.name })
      .from(athletes)
      .leftJoin(athleteAffiliations, and(
        eq(athleteAffiliations.athleteId, athletes.id),
        eq(athleteAffiliations.tenantId, tenantId),
        isNull(athleteAffiliations.endedAt),
      ))
      .leftJoin(clubs, eq(clubs.id, athleteAffiliations.clubId))
      .where(isNull(athletes.deletedAt))
    const byName = new Map<string, typeof athleteRows>()
    const byEmail = new Map<string, (typeof athleteRows)[number]>()
    for (const a of athleteRows) {
      byName.set(fold(a.name), [...(byName.get(fold(a.name)) ?? []), a])
      if (a.email) byEmail.set(a.email.toLowerCase(), a)
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
        current.person.email ??= p.email
      }
    }
    for (const e of validated.entries) { collect(e.athlete, e.row); collect(e.partner, e.row) }

    const resolved = new Map<string, ResolvedPerson>()
    const newClubNames = new Map<string, string>() // fold -> nome como digitado
    for (const [key, { person, rows }] of people) {
      const at = (message: string, field = 'Atleta') => errors.push({ sheet: 'Inscritos', row: rows[0]!, field, message })
      let match: (typeof athleteRows)[number] | undefined

      if (person.email) match = byEmail.get(person.email)
      if (!match) {
        const candidates = (byName.get(fold(person.name)) ?? []).filter((c) => !person.email || !c.email)
        if (candidates.length === 1) match = candidates[0]
        else if (candidates.length > 1) {
          const narrowed = person.club ? candidates.filter((c) => c.clubName && fold(c.clubName) === fold(person.club)) : []
          if (narrowed.length === 1) match = narrowed[0]
          else {
            const clubsSeen = [...new Set(candidates.map((c) => c.clubName ?? 'sem clube'))].join(', ')
            at(`Há ${candidates.length} atletas chamados "${person.name}" (${clubsSeen}). Informe o clube ou o e-mail para eu saber qual é.`)
            continue
          }
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
      if (person.club) {
        const clubKey = fold(person.club)
        if (clubByName.has(clubKey)) { /* clube existente */ } else if (!newClubNames.has(clubKey)) newClubNames.set(clubKey, person.club)
      }
    }
    report.summary.clubs.created = newClubNames.size
    report.summary.clubs.existing = new Set(
      [...resolved.values()].flatMap((r) => (r.ref_person.club && clubByName.has(fold(r.ref_person.club)) ? [fold(r.ref_person.club)] : [])),
    ).size

    // ----- Elegibilidade (gênero da disciplina, inativo, repetido, vagas), categoria a categoria
    const taken = new Map<string, Set<string>>()
    const counts = new Map<string, number>()
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
        return reply.status(422).send({ error: 'A planilha tem erros. Corrija e tente de novo.', code: 'IMPORT_INVALID', details: report })
      }
      return report
    }

    // ----- Grava tudo numa transação
    const t = validated.tournament!
    const tournamentId = randomUUID()
    await db.transaction(async (tx) => {
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
          id, name: person.ref_person.name, gender: person.gender, nationality: 'BR', active: true,
          ...(person.ref_person.email ? { email: person.ref_person.email } : {}),
        })
        athleteIdByRef.set(person.ref, id)
        const clubId = person.ref_person.club ? clubIdByKey.get(fold(person.ref_person.club)) : undefined
        if (clubId) await tx.insert(athleteAffiliations).values({ id: randomUUID(), athleteId: id, clubId, tenantId, startedAt: today })
      }

      await tx.insert(tournaments).values({
        id: tournamentId, tenantId, status: 'draft', name: t.name, slug, kind: t.kind, level: t.level,
        startDate: t.startDate, endDate: t.endDate, city: t.city, state: t.state, location: t.location,
      })
      const categoryIdByKey = new Map<string, string>()
      for (const c of validated.categories) {
        const id = randomUUID()
        categoryIdByKey.set(c.key, id)
        await tx.insert(tournamentCategories).values({ id, tournamentId, name: c.name, discipline: c.discipline, drawType: c.drawType, maxEntries: c.maxEntries })
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

    report.tournamentId = tournamentId
    return reply.status(201).send(report)
  })
}
