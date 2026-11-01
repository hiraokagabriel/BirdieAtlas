import type { ImportCategoryInput, ImportEntryInput } from '@birdie-atlas/validators'

// Leitura da planilha de importação de torneio (XLSX com abas ou CSV de uma tabela só) e o modelo para baixar.
// As células viram texto; a API normaliza e valida os rótulos em português (ver domain/tournament-import.ts na API).

export interface TournamentFields {
  name: string
  slug: string
  kind: string
  level: string
  startDate: string
  endDate: string
  city: string
  state: string
  location: string
}

export const EMPTY_TOURNAMENT_FIELDS: TournamentFields = {
  name: '', slug: '', kind: 'Oficial', level: 'Estadual', startDate: '', endDate: '', city: '', state: '', location: '',
}

export interface ParsedImport {
  tournament: Partial<TournamentFields>
  categories: ImportCategoryInput[]
  entries: ImportEntryInput[]
  /** Avisos de leitura (colunas ignoradas, categorias deduzidas...). */
  notes: string[]
}

/** Minúsculas, sem acento nem pontuação: "Máx. inscrições" vira "max inscricoes". */
export function fold(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Cabeçalhos aceitos (sinônimos), por tabela
// ---------------------------------------------------------------------------

type Key<T> = keyof T & string

const ENTRY_HEADERS: Record<string, Key<ImportEntryInput> | 'discipline' | 'drawType' | 'maxEntries'> = {
  categoria: 'category',
  atleta: 'athlete',
  nome: 'athlete',
  'parceiro a': 'partner',
  parceiro: 'partner',
  parceira: 'partner',
  sexo: 'gender',
  'sexo do parceiro a': 'partnerGender',
  'sexo do parceiro': 'partnerGender',
  clube: 'club',
  'clube do parceiro a': 'partnerClub',
  'clube do parceiro': 'partnerClub',
  'e mail': 'email',
  email: 'email',
  'e mail do parceiro a': 'partnerEmail',
  'email do parceiro': 'partnerEmail',
  'cabeca de chave': 'seed',
  cabeca: 'seed',
  seed: 'seed',
  situacao: 'status',
  status: 'status',
  // Só no CSV de uma tabela: atributos da categoria repetidos em cada linha.
  disciplina: 'discipline',
  formato: 'drawType',
  'max inscricoes': 'maxEntries',
}

const CATEGORY_HEADERS: Record<string, Key<ImportCategoryInput>> = {
  nome: 'name',
  categoria: 'name',
  disciplina: 'discipline',
  formato: 'drawType',
  'max inscricoes': 'maxEntries',
  'maximo de inscricoes': 'maxEntries',
  vagas: 'maxEntries',
}

const TOURNAMENT_LABELS: Record<string, keyof TournamentFields> = {
  nome: 'name',
  'endereco slug': 'slug',
  endereco: 'slug',
  slug: 'slug',
  tipo: 'kind',
  nivel: 'level',
  inicio: 'startDate',
  termino: 'endDate',
  fim: 'endDate',
  cidade: 'city',
  estado: 'state',
  local: 'location',
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** CSV com aspas (RFC 4180), separador `;` (Excel em português) ou `,`, e BOM opcional. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) && firstLine.includes(';') ? ';' : ','

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += ch
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// ---------------------------------------------------------------------------
// Células -> texto
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value).trim()
}

type Grid = unknown[][]

/** Primeira linha com algum cabeçalho conhecido vira o cabeçalho; devolve as linhas seguintes como objetos (com o nº da linha). */
function readTable<K extends string>(grid: Grid, headers: Record<string, K>): { rows: { row: number; values: Partial<Record<K, string>> }[]; ignored: string[] } {
  const headerIndex = grid.findIndex((r) => r.some((c) => fold(c) in headers))
  if (headerIndex === -1) return { rows: [], ignored: [] }
  const columns = (grid[headerIndex] ?? []).map((c) => headers[fold(c)] as K | undefined)
  const ignored = (grid[headerIndex] ?? []).filter((c, i) => !columns[i] && cellText(c)).map(cellText)
  const rows = grid.slice(headerIndex + 1).flatMap((cells, i) => {
    const values: Partial<Record<K, string>> = {}
    cells.forEach((cell, col) => {
      const key = columns[col]
      const text = cellText(cell)
      if (key && text !== '' && values[key] === undefined) values[key] = text
    })
    return Object.keys(values).length > 0 ? [{ row: headerIndex + i + 2, values }] : []
  })
  return { rows, ignored }
}

function readTournament(grid: Grid): Partial<TournamentFields> {
  const out: Partial<TournamentFields> = {}
  for (const cells of grid) {
    const field = TOURNAMENT_LABELS[fold(cells[0])]
    const value = cellText(cells[1])
    if (field && value) out[field] = value
  }
  return out
}

function deriveCategories(entries: ImportEntryInput[], attrs: Map<string, Partial<ImportCategoryInput>>, rows: Map<string, number>): ImportCategoryInput[] {
  const seen = new Map<string, ImportCategoryInput>()
  for (const e of entries) {
    const key = fold(e.category)
    if (!key || seen.has(key)) continue
    const a = attrs.get(key) ?? {}
    seen.set(key, { row: rows.get(key) ?? e.row, name: e.category, discipline: a.discipline ?? '', ...(a.drawType ? { drawType: a.drawType } : {}), ...(a.maxEntries ? { maxEntries: a.maxEntries } : {}) })
  }
  return [...seen.values()]
}

function entriesFrom(rows: { row: number; values: Partial<Record<string, string>> }[]) {
  const entries: ImportEntryInput[] = []
  const attrs = new Map<string, Partial<ImportCategoryInput>>()
  const firstRow = new Map<string, number>()
  for (const { row, values } of rows) {
    const category = values.category ?? ''
    const key = fold(category)
    if (key) {
      const a = attrs.get(key) ?? {}
      if (values.discipline && !a.discipline) a.discipline = values.discipline
      if (values.drawType && !a.drawType) a.drawType = values.drawType
      if (values.maxEntries && !a.maxEntries) a.maxEntries = values.maxEntries
      attrs.set(key, a)
      if (!firstRow.has(key)) firstRow.set(key, row)
    }
    entries.push({
      row,
      category,
      athlete: values.athlete ?? '',
      ...(values.partner ? { partner: values.partner } : {}),
      ...(values.gender ? { gender: values.gender } : {}),
      ...(values.partnerGender ? { partnerGender: values.partnerGender } : {}),
      ...(values.club ? { club: values.club } : {}),
      ...(values.partnerClub ? { partnerClub: values.partnerClub } : {}),
      ...(values.email ? { email: values.email } : {}),
      ...(values.partnerEmail ? { partnerEmail: values.partnerEmail } : {}),
      ...(values.seed ? { seed: values.seed } : {}),
      ...(values.status ? { status: values.status } : {}),
    })
  }
  return { entries, attrs, firstRow }
}

/** Monta o que a API espera a partir das abas (XLSX) ou de uma tabela só (CSV). */
export function parseSheets(sheets: { name: string; grid: Grid }[]): ParsedImport {
  const notes: string[] = []
  const named = (...names: string[]) => sheets.find((s) => names.includes(fold(s.name)))
  const tournamentSheet = named('torneio', 'campeonato')
  const categoriesSheet = named('categorias')
  const entriesSheet = named('inscritos', 'inscricoes', 'atletas') ?? (sheets.length === 1 ? sheets[0] : undefined)

  if (!entriesSheet) {
    notes.push('Não encontrei a aba "Inscritos". Use o modelo para baixar a planilha no formato certo.')
    return { tournament: {}, categories: [], entries: [], notes }
  }

  const table = readTable(entriesSheet.grid, ENTRY_HEADERS)
  if (table.rows.length === 0) notes.push('A aba de inscritos não tem linhas com dados.')
  if (table.ignored.length > 0) notes.push(`Colunas ignoradas: ${table.ignored.join(', ')}.`)
  const { entries, attrs, firstRow } = entriesFrom(table.rows)

  let categories: ImportCategoryInput[]
  if (categoriesSheet) {
    const cats = readTable(categoriesSheet.grid, CATEGORY_HEADERS)
    categories = cats.rows.map(({ row, values }) => ({
      row,
      name: values.name ?? '',
      discipline: values.discipline ?? '',
      ...(values.drawType ? { drawType: values.drawType } : {}),
      ...(values.maxEntries ? { maxEntries: values.maxEntries } : {}),
    }))
  } else {
    categories = deriveCategories(entries, attrs, firstRow)
    if (categories.length > 0) notes.push('Sem aba "Categorias": as categorias foram deduzidas da coluna Categoria (use as colunas Disciplina e Formato para configurá-las).')
  }

  return { tournament: tournamentSheet ? readTournament(tournamentSheet.grid) : {}, categories, entries, notes }
}

/** Lê um arquivo .xlsx ou .csv. */
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    return parseSheets([{ name: 'Inscritos', grid: parseCsv(await file.text()) }])
  }
  if (name.endsWith('.xlsx')) {
    const { default: readExcelFile } = await import('read-excel-file/browser')
    const sheets = await readExcelFile(file)
    return parseSheets(sheets.map((s) => ({ name: s.sheet, grid: s.data as Grid })))
  }
  throw new Error('Use um arquivo .xlsx ou .csv.')
}

// ---------------------------------------------------------------------------
// Modelo para baixar
// ---------------------------------------------------------------------------

export const ENTRY_COLUMNS = ['Categoria', 'Atleta', 'Parceiro(a)', 'Sexo', 'Sexo do parceiro(a)', 'Clube', 'Clube do parceiro(a)', 'E-mail', 'E-mail do parceiro(a)', 'Cabeça de chave', 'Situação'] as const
export const CATEGORY_COLUMNS = ['Nome', 'Disciplina', 'Formato', 'Máx. inscrições'] as const

export const EXAMPLE_TOURNAMENT: [string, string, string][] = [
  ['Nome', 'Aberto de Exemplo', 'Obrigatório.'],
  ['Endereço (slug)', '', 'Opcional. Em branco, é gerado do nome.'],
  ['Tipo', 'Oficial', 'Oficial (pontua nos rankings) ou Amistoso (não pontua).'],
  ['Nível', 'Estadual', 'Local, Regional, Estadual, Nacional ou Internacional.'],
  ['Início', '15/11/2026', 'DD/MM/AAAA. Obrigatório.'],
  ['Término', '17/11/2026', 'DD/MM/AAAA. Obrigatório.'],
  ['Cidade', 'São Paulo', 'Opcional.'],
  ['Estado', 'SP', 'Opcional. Sigla com 2 letras.'],
  ['Local', 'Ginásio Central', 'Opcional.'],
]

export const EXAMPLE_CATEGORIES: string[][] = [
  ['Simples Masculino', 'Simples Masculino', 'Eliminação simples', '16'],
  ['Simples Feminino', 'Simples Feminino', 'Todos contra todos', ''],
  ['Duplas Masculinas', 'Duplas Masculinas', 'Grupos + eliminatória', ''],
]

export const EXAMPLE_ENTRIES: string[][] = [
  ['Simples Masculino', 'Exemplo Carlos Almeida', '', 'M', '', 'Clube Exemplo', '', '', '', '1', 'Aprovada'],
  ['Simples Masculino', 'Exemplo Bruno Costa', '', 'M', '', 'Clube Exemplo', '', '', '', '2', 'Aprovada'],
  ['Simples Masculino', 'Exemplo Diego Lima', '', 'M', '', 'Clube Modelo', '', '', '', '', 'Pendente'],
  ['Simples Feminino', 'Exemplo Ana Souza', '', 'F', '', 'Clube Modelo', '', '', '', '', 'Aprovada'],
  ['Simples Feminino', 'Exemplo Bia Martins', '', 'F', '', 'Clube Exemplo', '', '', '', '', 'Aprovada'],
  ['Duplas Masculinas', 'Exemplo Carlos Almeida', 'Exemplo Bruno Costa', 'M', 'M', 'Clube Exemplo', 'Clube Exemplo', '', '', '1', 'Aprovada'],
  ['Duplas Masculinas', 'Exemplo Diego Lima', 'Exemplo Eduardo Reis', 'M', 'M', 'Clube Modelo', 'Clube Modelo', '', '', '', 'Aprovada'],
]

const INSTRUCTIONS: string[] = [
  'Como preencher',
  '',
  'Aba Torneio: dados gerais (campo na coluna A, valor na coluna B). Nome, Início e Término são obrigatórios.',
  'Aba Categorias: uma linha por categoria. Disciplina: Simples Masculino, Simples Feminino, Duplas Masculinas, Duplas Femininas ou Misto.',
  'Formato: Eliminação simples (padrão), Todos contra todos, Grupos + eliminatória, Suíço ou Eliminação dupla. Máx. inscrições é opcional.',
  'Aba Inscritos: uma linha por inscrição. A categoria precisa existir na aba Categorias.',
  'Duplas: preencha Parceiro(a). Simples: deixe Parceiro(a) em branco.',
  'Atletas já cadastrados são reconhecidos pelo nome (sem diferenciar acentos). Se houver nomes iguais, informe o Clube ou o E-mail.',
  'Atleta novo: informe o Sexo (M ou F). O clube é criado se ainda não existir.',
  'Cabeça de chave (opcional): 1, 2, 3... Situação: Aprovada (padrão), Pendente ou Recusada.',
  'Arquivo CSV: uma tabela só, com as colunas da aba Inscritos mais Disciplina, Formato e Máx. inscrições (valem para a categoria na primeira linha dela). Os dados do torneio são preenchidos na tela.',
  'As linhas de exemplo deste modelo criam atletas "Exemplo ..." de verdade: apague-as antes de importar o seu torneio.',
]

function csvEscape(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** CSV de uma tabela só (Excel em português): inscritos + atributos da categoria. */
export function buildTemplateCsv(): string {
  const header = [...ENTRY_COLUMNS, 'Disciplina', 'Formato', 'Máx. inscrições']
  const categoryByName = new Map(EXAMPLE_CATEGORIES.map((c) => [c[0]!, c]))
  const rows = EXAMPLE_ENTRIES.map((e) => {
    const c = categoryByName.get(e[0]!)
    return [...e, c?.[1] ?? '', c?.[2] ?? '', c?.[3] ?? '']
  })
  return '﻿' + [header, ...rows].map((r) => r.map(csvEscape).join(';')).join('\r\n') + '\r\n'
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTemplateXlsx(): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const head = (labels: readonly string[]) => labels.map((value) => ({ value, fontWeight: 'bold' as const }))
  await writeExcelFile([
    { sheet: 'Instruções', data: INSTRUCTIONS.map((line, i) => [i === 0 ? { value: line, fontWeight: 'bold' as const } : { value: line }]), columns: [{ width: 120 }] },
    { sheet: 'Torneio', data: [head(['Campo', 'Valor', 'Observação']), ...EXAMPLE_TOURNAMENT.map((r) => r.map((value) => ({ value })))], columns: [{ width: 20 }, { width: 28 }, { width: 60 }] },
    { sheet: 'Categorias', data: [head(CATEGORY_COLUMNS), ...EXAMPLE_CATEGORIES.map((r) => r.map((value) => ({ value })))], columns: [{ width: 26 }, { width: 22 }, { width: 24 }, { width: 16 }] },
    { sheet: 'Inscritos', data: [head(ENTRY_COLUMNS), ...EXAMPLE_ENTRIES.map((r) => r.map((value) => ({ value })))], columns: ENTRY_COLUMNS.map(() => ({ width: 22 })) },
  ]).toFile('modelo-torneio.xlsx')
}

export function downloadTemplateCsv(): void {
  downloadBlob(new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' }), 'modelo-torneio.csv')
}
