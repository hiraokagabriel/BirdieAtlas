import {
  DEFAULT_SCORING, SCORING_PRESETS, TOURNAMENT_LEVELS,
  type ImportIntoTournamentInput, type ImportIssue, type ImportTournamentInput, type ScoringRule,
} from '@birdie-atlas/validators'
import { normalizeSearchText } from './athlete-search.js'
import { isDoublesDiscipline } from './eligibility.js'
import type { DrawFormat } from './placements.js'

// Importação de torneio por planilha: normalização dos rótulos em português e validação que não precisa do banco.
// A resolução de atletas e clubes existentes e a gravação ficam em routes/import-tournament.ts.

export type Discipline = 'MS' | 'WS' | 'MD' | 'WD' | 'XD'
export type Gender = 'M' | 'F'
export type RegistrationStatus = 'approved' | 'pending' | 'rejected'
export type TournamentLevel = (typeof TOURNAMENT_LEVELS)[number]

/** Minúsculas, sem acentos nem pontuação, espaços colapsados: "Simples Masc." vira "simples masc". */
export function fold(value: string | undefined | null): string {
  return normalizeSearchText(value ?? '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function lookup<T>(table: Record<string, readonly string[]>, raw: string | undefined): T | null {
  const key = fold(raw)
  for (const [value, names] of Object.entries(table)) if (names.includes(key)) return value as T
  return null
}

const DISCIPLINES: Record<Discipline, readonly string[]> = {
  MS: ['ms', 'simples masculino', 'simples masc', 'simples m', 'individual masculino'],
  WS: ['ws', 'simples feminino', 'simples fem', 'simples f', 'individual feminino'],
  MD: ['md', 'duplas masculinas', 'duplas masculino', 'dupla masculina', 'duplas masc', 'dupla masc'],
  WD: ['wd', 'duplas femininas', 'duplas feminino', 'dupla feminina', 'duplas fem', 'dupla fem'],
  XD: ['xd', 'misto', 'mista', 'duplas mistas', 'dupla mista', 'duplas misto'],
}

const DRAW_TYPES: Record<DrawFormat, readonly string[]> = {
  single_elimination: ['', 'eliminacao simples', 'mata mata', 'single elimination'],
  round_robin: ['todos contra todos', 'round robin', 'rodizio'],
  group_then_elimination: ['grupos', 'grupos eliminatoria', 'grupos e eliminatoria', 'grupos mata mata'],
  swiss: ['suico', 'sistema suico'],
  double_elimination: ['eliminacao dupla', 'double elimination'],
}

const LEVELS: Record<TournamentLevel, readonly string[]> = {
  local: ['local', 'municipal'],
  regional: ['regional'],
  state: ['', 'estadual', 'estado', 'state'],
  national: ['nacional', 'national'],
  international: ['internacional', 'international'],
}

export const parseDiscipline = (raw?: string) => lookup<Discipline>(DISCIPLINES, raw)
export const parseDrawType = (raw?: string) => lookup<DrawFormat>(DRAW_TYPES, raw)
export const parseLevel = (raw?: string) => lookup<TournamentLevel>(LEVELS, raw)

export function parseKind(raw?: string): 'official' | 'friendly' | null {
  const key = fold(raw)
  if (['', 'oficial', 'official'].includes(key)) return 'official'
  if (['amistoso', 'friendly'].includes(key)) return 'friendly'
  return null
}

/** Vazio devolve `undefined` (sem informação); texto desconhecido devolve `null` (inválido). */
export function parseGender(raw?: string): Gender | undefined | null {
  const key = fold(raw)
  if (key === '') return undefined
  if (['m', 'masculino', 'masc', 'homem'].includes(key)) return 'M'
  if (['f', 'feminino', 'fem', 'mulher'].includes(key)) return 'F'
  return null
}

export function parseStatus(raw?: string): RegistrationStatus | null {
  const key = fold(raw)
  if (['', 'aprovada', 'aprovado', 'confirmada', 'confirmado', 'sim'].includes(key)) return 'approved'
  if (['pendente', 'em analise', 'aguardando'].includes(key)) return 'pending'
  if (['recusada', 'recusado', 'nao'].includes(key)) return 'rejected'
  return null
}

function validDate(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** AAAA-MM-DD ou DD/MM/AAAA (como o Excel em português grava), com data real do calendário. */
export function parseDate(raw?: string): string | null {
  const text = (raw ?? '').trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (m) return validDate(Number(m[3]), Number(m[2]), Number(m[1]))
  return null
}

/** Vazio devolve `undefined`; número inteiro positivo devolve o número; o resto devolve `null`. */
export function parsePositiveInt(raw?: string): number | undefined | null {
  const text = (raw ?? '').trim()
  if (text === '') return undefined
  if (!/^\d+$/.test(text)) return null
  const n = Number(text)
  return n >= 1 ? n : null
}

export function toSlug(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export interface PersonRef {
  name: string
  gender: Gender | null
  club: string | null
}

export interface NormalizedTournament {
  name: string
  slug: string | null
  kind: 'official' | 'friendly'
  level: TournamentLevel
  startDate: string
  endDate: string
  city: string | null
  state: string | null
  location: string | null
}

export interface NormalizedCategory {
  row: number
  name: string
  key: string
  discipline: Discipline
  drawType: DrawFormat
  maxEntries: number | null
  scoring: ScoringRule
  /** Categoria que já existe no torneio (importação para torneio existente): recebe as inscrições, sem mudar. */
  existingId?: string
}

/** Categoria já cadastrada no torneio de destino. */
export interface ExistingCategory {
  id: string
  name: string
  discipline: Discipline
  drawType: DrawFormat
  maxEntries: number | null
  scoring: ScoringRule
  /** Já tem chave sorteada: não recebe inscrição nova. */
  locked?: boolean
}

export interface NormalizedEntry {
  row: number
  category: NormalizedCategory
  athlete: PersonRef
  partner: PersonRef | null
  seed: number | null
  status: RegistrationStatus
}

export interface ValidatedImport {
  errors: ImportIssue[]
  warnings: ImportIssue[]
  tournament: NormalizedTournament | null
  categories: NormalizedCategory[]
  entries: NormalizedEntry[]
}

const blank = (value: string | undefined): string | null => {
  const text = (value ?? '').trim()
  return text === '' ? null : text
}

function person(name: string, gender: Gender | null, club: string | undefined): PersonRef {
  return { name: name.trim().replace(/\s+/g, ' '), gender, club: blank(club) }
}

/** Identifica a mesma pessoa dentro da planilha: nome + clube. */
export function personKey(p: PersonRef): string {
  return `nome:${fold(p.name)}|${fold(p.club)}`
}

/** Pontuação pela coluna "Pontuação": 21, 15 ou 11 (os modelos), ou o rótulo do modelo; vazio = 21. */
export function parseScoring(raw?: string): ScoringRule | null {
  const text = fold(raw)
  if (!text) return DEFAULT_SCORING
  const points = /^(\d+)/.exec(text)?.[1]
  return SCORING_PRESETS.find((p) => String(p.rule.pointsPerSet) === points || fold(p.label) === text)?.rule ?? null
}

/**
 * Valida as linhas da planilha. Com `existing`, é a importação para um torneio já criado: a aba Torneio é ignorada,
 * categorias de mesmo nome usam a da plataforma (a disciplina precisa bater) e inscritos podem apontar para
 * categorias que só existem na plataforma.
 */
export function validateImportInput(
  input: ImportTournamentInput | ImportIntoTournamentInput,
  existing?: readonly ExistingCategory[],
): ValidatedImport {
  const errors: ImportIssue[] = []
  const warnings: ImportIssue[] = []
  const error = (sheet: ImportIssue['sheet'], row: number, field: string, message: string) => errors.push({ sheet, row, field, message })
  const existingByKey = new Map<string, ExistingCategory>()
  // Duas categorias do torneio com o mesmo nome (só acento ou caixa diferentes): a planilha não sabe qual é.
  const ambiguous = new Set<string>()
  for (const c of existing ?? []) {
    const k = fold(c.name)
    if (existingByKey.has(k)) ambiguous.add(k)
    else existingByKey.set(k, c)
  }
  const ambiguousMessage = (label: string) => `Há duas categorias no torneio com o nome "${label}" (só acento ou caixa diferentes). Renomeie uma delas antes de importar.`

  // ----- Torneio
  let tournament: NormalizedTournament | null = null
  if ('tournament' in input) {
  const t = input.tournament
  const name = t.name.trim()
  if (!name) error('Torneio', 0, 'Nome', 'Informe o nome do torneio.')
  const start = parseDate(t.startDate)
  const end = parseDate(t.endDate)
  if (!start) error('Torneio', 0, 'Início', 'Data de início inválida. Use DD/MM/AAAA ou AAAA-MM-DD.')
  if (!end) error('Torneio', 0, 'Término', 'Data de término inválida. Use DD/MM/AAAA ou AAAA-MM-DD.')
  if (start && end && end < start) error('Torneio', 0, 'Término', 'O término não pode ser antes do início.')
  const kind = parseKind(t.kind)
  if (!kind) error('Torneio', 0, 'Tipo', 'Tipo inválido. Use "Oficial" ou "Amistoso".')
  const level = parseLevel(t.level)
  if (!level) error('Torneio', 0, 'Nível', 'Nível inválido. Use Local, Regional, Estadual, Nacional ou Internacional.')
  const slug = blank(t.slug)
  if (slug && !/^[a-z0-9-]+$/.test(slug)) error('Torneio', 0, 'Endereço (slug)', 'Use só letras minúsculas, números e hífens.')
  const state = blank(t.state)
  if (state && state.length > 2) error('Torneio', 0, 'Estado', 'Use a sigla do estado, com 2 letras.')
  if (name && start && end && kind && level) {
    tournament = { name, slug, kind, level, startDate: start, endDate: end, city: blank(t.city), state: state?.toUpperCase() ?? null, location: blank(t.location) }
  }
  }

  // ----- Categorias
  const categories: NormalizedCategory[] = []
  const byKey = new Map<string, NormalizedCategory>()
  if (input.categories.length === 0 && existingByKey.size === 0) error('Categorias', 0, 'Categorias', 'A planilha não tem nenhuma categoria.')
  for (const c of input.categories) {
    const label = c.name.trim()
    if (!label) { error('Categorias', c.row, 'Nome', 'Informe o nome da categoria.'); continue }
    const key = fold(label)
    if (byKey.has(key)) { error('Categorias', c.row, 'Nome', `Categoria repetida: "${label}".`); continue }
    if (ambiguous.has(key)) { error('Categorias', c.row, 'Nome', ambiguousMessage(label)); continue }
    // Categoria da plataforma citada sem disciplina (CSV sem aba Categorias): usa a de lá.
    const onPlatform = existingByKey.get(key)
    const discipline = parseDiscipline(c.discipline) ?? (onPlatform && !c.discipline.trim() ? onPlatform.discipline : null)
    if (!discipline) { error('Categorias', c.row, 'Disciplina', `Disciplina inválida: "${c.discipline}". Use Simples Masculino, Simples Feminino, Duplas Masculinas, Duplas Femininas ou Misto.`); continue }
    // Categoria que já existe: vale a configuração da plataforma, então formato, limite e pontuação da planilha nem são lidos.
    const current = onPlatform
    if (current && current.discipline !== discipline) {
      error('Categorias', c.row, 'Disciplina', `"${current.name}" já existe no torneio com outra disciplina. Use outro nome ou a mesma disciplina.`)
      continue
    }
    if (current?.locked) {
      error('Categorias', c.row, 'Nome', `"${current.name}" já tem chave sorteada no torneio e não recebe novas inscrições.`)
      continue
    }
    if (current) {
      warnings.push({ sheet: 'Categorias', row: c.row, field: 'Nome', message: `"${current.name}" já existe no torneio: as inscrições entram nela, com o formato, o limite e a pontuação de lá.` })
      const reused: NormalizedCategory = { row: c.row, name: current.name, key, discipline, drawType: current.drawType, maxEntries: current.maxEntries, scoring: current.scoring, existingId: current.id }
      categories.push(reused)
      byKey.set(key, reused)
      continue
    }
    const drawType = parseDrawType(c.drawType)
    if (!drawType) { error('Categorias', c.row, 'Formato', `Formato inválido: "${c.drawType}". Use Eliminação simples, Todos contra todos, Grupos + eliminatória, Suíço ou Eliminação dupla.`); continue }
    const maxEntries = parsePositiveInt(c.maxEntries)
    if (maxEntries === null) { error('Categorias', c.row, 'Máx. inscrições', 'Use um número inteiro maior que zero (ou deixe em branco).'); continue }
    const scoring = parseScoring(c.scoring)
    if (!scoring) { error('Categorias', c.row, 'Pontuação', `Pontuação inválida: "${c.scoring}". Use 21, 15 ou 11 (ou deixe em branco para 21).`); continue }
    const normalized: NormalizedCategory = { row: c.row, name: label, key, discipline, drawType, maxEntries: maxEntries ?? null, scoring }
    categories.push(normalized)
    byKey.set(key, normalized)
  }

  // ----- Inscritos
  const entries: NormalizedEntry[] = []
  const seenInCategory = new Map<string, Set<string>>()
  const seedsInCategory = new Map<string, Set<number>>()
  for (const e of input.entries) {
    const catLabel = e.category.trim()
    let category = byKey.get(fold(catLabel))
    if (!category && ambiguous.has(fold(catLabel))) { error('Inscritos', e.row, 'Categoria', ambiguousMessage(catLabel)); continue }
    const onPlatform = existingByKey.get(fold(catLabel))
    if (!category && onPlatform?.locked) {
      error('Inscritos', e.row, 'Categoria', `"${onPlatform.name}" já tem chave sorteada e não recebe novas inscrições.`)
      continue
    }
    if (!category && onPlatform) {
      // Categoria só da plataforma: entra na lista para receber as inscrições.
      category = { row: 0, name: onPlatform.name, key: fold(catLabel), discipline: onPlatform.discipline, drawType: onPlatform.drawType, maxEntries: onPlatform.maxEntries, scoring: onPlatform.scoring, existingId: onPlatform.id }
      categories.push(category)
      byKey.set(category.key, category)
    }
    if (!category) {
      const where = existing ? 'nem na aba Categorias nem no torneio' : 'na aba Categorias'
      error('Inscritos', e.row, 'Categoria', catLabel ? `Categoria "${catLabel}" não existe ${where}.` : 'Informe a categoria.')
      continue
    }
    const before = errors.length
    if (!e.athlete.trim()) error('Inscritos', e.row, 'Atleta', 'Informe o nome do atleta.')

    const gender = parseGender(e.gender)
    if (gender === null) error('Inscritos', e.row, 'Sexo', 'Sexo inválido. Use M ou F.')
    const partnerGender = parseGender(e.partnerGender)
    if (partnerGender === null) error('Inscritos', e.row, 'Sexo do parceiro(a)', 'Sexo inválido. Use M ou F.')
    const status = parseStatus(e.status)
    if (!status) error('Inscritos', e.row, 'Situação', 'Situação inválida. Use Aprovada, Pendente ou Recusada.')
    const seed = parsePositiveInt(e.seed)
    if (seed === null) error('Inscritos', e.row, 'Cabeça de chave', 'Use um número inteiro maior que zero (ou deixe em branco).')

    const doubles = isDoublesDiscipline(category.discipline)
    const partnerName = (e.partner ?? '').trim()
    if (doubles && !partnerName) error('Inscritos', e.row, 'Parceiro(a)', `A categoria "${category.name}" é de duplas: informe o(a) parceiro(a).`)
    if (!doubles && partnerName) error('Inscritos', e.row, 'Parceiro(a)', `A categoria "${category.name}" é de simples: deixe o(a) parceiro(a) em branco.`)

    if (errors.length > before) continue

    // Simples: o sexo vem da modalidade (masculino = M, feminino = F). Em duplas ele precisa ser informado antes.
    const impliedGender: Gender | null = category.discipline === 'MS' ? 'M' : category.discipline === 'WS' ? 'F' : null
    if (impliedGender && gender && gender !== impliedGender) {
      error('Inscritos', e.row, 'Sexo', `A categoria "${category.name}" é ${impliedGender === 'M' ? 'masculina' : 'feminina'}, mas o sexo informado é ${gender}.`)
      continue
    }
    const athlete = person(e.athlete, gender ?? impliedGender, e.club)
    const partner = doubles ? person(partnerName, partnerGender ?? null, e.partnerClub ?? e.club) : null
    const keys = [personKey(athlete), ...(partner ? [personKey(partner)] : [])]
    if (partner && keys[0] === keys[1]) { error('Inscritos', e.row, 'Parceiro(a)', 'O(a) parceiro(a) não pode ser a mesma pessoa.'); continue }

    const seen = seenInCategory.get(category.key) ?? new Set<string>()
    const repeated = keys.find((k) => seen.has(k))
    if (repeated && status !== 'rejected') { error('Inscritos', e.row, 'Atleta', `${athlete.name} já está inscrito(a) em "${category.name}".`); continue }
    if (status !== 'rejected') keys.forEach((k) => seen.add(k))
    seenInCategory.set(category.key, seen)

    if (seed !== undefined && seed !== null) {
      const seeds = seedsInCategory.get(category.key) ?? new Set<number>()
      if (seeds.has(seed)) { error('Inscritos', e.row, 'Cabeça de chave', `A cabeça de chave ${seed} já foi usada em "${category.name}".`); continue }
      seeds.add(seed)
      seedsInCategory.set(category.key, seeds)
    }

    entries.push({ row: e.row, category, athlete, partner, seed: seed ?? null, status: status! })
  }

  for (const category of categories) {
    const count = entries.filter((e) => e.category === category && e.status !== 'rejected').length
    if (category.maxEntries !== null && count > category.maxEntries) {
      error('Inscritos', 0, 'Categoria', `"${category.name}" tem ${count} inscritos, mais que o limite de ${category.maxEntries}.`)
    }
    if (count === 0 && !category.existingId) warnings.push({ sheet: 'Categorias', row: category.row, field: 'Nome', message: `"${category.name}" não tem nenhum inscrito.` })
  }

  return { errors, warnings, tournament, categories, entries }
}
