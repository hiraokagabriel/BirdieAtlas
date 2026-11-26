import type { ImportCategoryInput, ImportEntryInput } from '@birdie-atlas/validators'
import { parseConsolidatedWorkbook } from './consolidated-import'

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
  /** Planilha consolidada: uma aba por torneio. Cada aba lida, para o usuário escolher qual importar. */
  alternatives?: { name: string; parsed: ParsedImport }[]
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

const ENTRY_HEADERS: Record<string, Key<ImportEntryInput> | 'discipline' | 'drawType' | 'maxEntries' | 'scoring'> = {
  pontuacao: 'scoring',
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
  pontuacao: 'scoring',
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
  const source = text.replace(/^\uFEFF/, '')
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
  // O leitor de XLSX devolve a data do Excel à meia-noite UTC: ler no fuso local (ex.: UTC-3) daria o dia anterior.
  if (value instanceof Date) return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
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
    seen.set(key, { row: rows.get(key) ?? e.row, name: e.category, discipline: a.discipline ?? '', ...(a.drawType ? { drawType: a.drawType } : {}), ...(a.maxEntries ? { maxEntries: a.maxEntries } : {}), ...(a.scoring ? { scoring: a.scoring } : {}) })
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
      if (values.scoring && !a.scoring) a.scoring = values.scoring
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
      ...(values.seed ? { seed: values.seed } : {}),
      ...(values.status ? { status: values.status } : {}),
    })
  }
  return { entries, attrs, firstRow }
}

/** Categorias e pares (categoria, atleta) de exemplo do modelo: só essas linhas são ignoradas, nunca um nome real parecido. */
const EXAMPLE_CATEGORY_KEYS = (): Set<string> => new Set(EXAMPLE_CATEGORIES.map((c) => fold(c[0])))
const EXAMPLE_ENTRY_KEYS = (): Set<string> => new Set(EXAMPLE_ENTRIES.map((e) => `${fold(e[0])}|${fold(e[1])}`))
export const isExampleCategory = (name: string | undefined): boolean => EXAMPLE_CATEGORY_KEYS().has(fold(name))
export const isExampleEntry = (category: string | undefined, athlete: string | undefined): boolean =>
  EXAMPLE_ENTRY_KEYS().has(`${fold(category)}|${fold(athlete)}`)

/** Monta o que a API espera a partir das abas (XLSX) ou de uma tabela só (CSV). */
export function parseSheets(sheets: { name: string; grid: Grid }[]): ParsedImport {
  const consolidated = parseConsolidatedWorkbook(sheets)
  if (consolidated) return consolidated

  const notes: string[] = []
  const named = (...names: string[]) => sheets.find((s) => names.includes(fold(s.name)))
  const tournamentSheet = named('torneio', 'campeonato')
  const categoriesSheet = named('categorias')
  const entriesSheet = named('inscritos', 'inscricoes', 'atletas') ?? (sheets.length === 1 ? sheets[0] : undefined)

  if (!entriesSheet) {
    notes.push('Não encontrei a aba "Inscritos". Use o modelo para baixar a planilha no formato certo.')
    return { tournament: {}, categories: [], entries: [], notes }
  }

  const read = readTable(entriesSheet.grid, ENTRY_HEADERS)
  // Linhas de exemplo do modelo ("Exemplo ...") não entram: o modelo pode ser preenchido por cima delas.
  const table = { ...read, rows: read.rows.filter((r) => !isExampleEntry(r.values.category, r.values.athlete)) }
  const skipped = read.rows.length - table.rows.length
  if (skipped > 0) notes.push(`${skipped} ${skipped === 1 ? 'linha de exemplo ignorada' : 'linhas de exemplo ignoradas'}.`)
  if (table.rows.length === 0) notes.push('A aba de inscritos não tem linhas com dados.')
  if (table.ignored.length > 0) notes.push(`Colunas ignoradas: ${table.ignored.join(', ')}.`)
  const { entries, attrs, firstRow } = entriesFrom(table.rows)

  let categories: ImportCategoryInput[]
  if (categoriesSheet) {
    const cats = readTable(categoriesSheet.grid, CATEGORY_HEADERS)
    categories = cats.rows.filter(({ values }) => !isExampleCategory(values.name)).map(({ row, values }) => ({
      row,
      name: values.name ?? '',
      discipline: values.discipline ?? '',
      ...(values.drawType ? { drawType: values.drawType } : {}),
      ...(values.maxEntries ? { maxEntries: values.maxEntries } : {}),
      ...(values.scoring ? { scoring: values.scoring } : {}),
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

export const ENTRY_COLUMNS = ['Categoria', 'Atleta', 'Parceiro(a)', 'Sexo', 'Sexo do parceiro(a)', 'Clube', 'Clube do parceiro(a)', 'Cabeça de chave', 'Situação'] as const
export const CATEGORY_COLUMNS = ['Nome', 'Disciplina', 'Formato', 'Máx. inscrições', 'Pontuação'] as const
/** CSV (uma tabela só): os inscritos mais os atributos da categoria, que valem na primeira linha dela. */
export const CSV_COLUMNS = [...ENTRY_COLUMNS, 'Disciplina', 'Formato', 'Máx. inscrições', 'Pontuação'] as const

/** Opções das listas do modelo (a API aceita também siglas e variações; ver docs). */
export const TEMPLATE_OPTIONS = {
  discipline: ['Simples Masculino', 'Simples Feminino', 'Duplas Masculinas', 'Duplas Femininas', 'Misto'],
  drawType: ['Eliminação simples', 'Todos contra todos', 'Grupos + eliminatória', 'Suíço', 'Eliminação dupla'],
  scoring: ['21', '15', '11'],
  gender: ['M', 'F'],
  status: ['Aprovada', 'Pendente', 'Recusada'],
} as const

/** Linhas de exemplo: começam com "Exemplo" e a importação as ignora. */
export const EXAMPLE_CATEGORIES: string[][] = [
  ['Exemplo Simples Masculino A', 'Simples Masculino', 'Eliminação simples', '16', '21'],
  ['Exemplo Duplas Mistas', 'Misto', 'Grupos + eliminatória', '', '15'],
]

export const EXAMPLE_ENTRIES: string[][] = [
  ['Exemplo Simples Masculino A', 'Exemplo Carlos Almeida', '', 'M', '', 'Clube Exemplo', '', '1', 'Aprovada'],
  ['Exemplo Simples Masculino A', 'Exemplo Bruno Costa', '', 'M', '', 'Clube Exemplo', '', '', 'Pendente'],
  ['Exemplo Duplas Mistas', 'Exemplo Diego Lima', 'Exemplo Ana Souza', 'M', 'F', 'Clube Modelo', 'Clube Modelo', '', 'Aprovada'],
]

export const TEMPLATE_INSTRUCTIONS: string[] = [
  'Como preencher',
  'Crie e configure o campeonato no BirdieAtlas. Depois, na página dele, use "Importar planilha" com este arquivo.',
  'Aba Categorias: uma linha por categoria. Se o nome for igual ao de uma categoria já criada na plataforma, as inscrições entram nela e a configuração de lá vale.',
  'Disciplina: Simples Masculino, Simples Feminino, Duplas Masculinas, Duplas Femininas ou Misto.',
  'Formato: Eliminação simples (padrão), Todos contra todos, Grupos + eliminatória, Suíço ou Eliminação dupla. Máx. inscrições é opcional.',
  'Pontuação: 21 (21 pontos, teto 30, padrão), 15 (15 pontos, teto 21) ou 11 (11 pontos, melhor de 5).',
  'Aba Inscritos: uma linha por inscrição. Duplas: preencha Parceiro(a). Simples: deixe em branco.',
  'Atletas já cadastrados são reconhecidos pelo nome (sem diferenciar acentos). Com nomes iguais, informe o Clube.',
  'Atleta novo: em Simples o Sexo vem da categoria; em Duplas informe o Sexo (M ou F) dos dois. Clube que não existe é criado.',
  'Cabeça de chave (opcional): 1, 2, 3... Situação: Aprovada (padrão), Pendente ou Recusada.',
  'As linhas de exemplo (em cinza, com nomes "Exemplo ...") são ignoradas: escreva por cima delas ou apague-as.',
  'Antes de gravar, a plataforma verifica tudo e mostra os erros por linha. Nada é gravado enquanto houver erro.',
  'Prefere CSV? Use o modelo .csv: uma tabela só, separada por ponto e vírgula, com as colunas de Inscritos mais Disciplina, Formato, Máx. inscrições e Pontuação.',
]

/** Arquivos do modelo, gerados por `pnpm --filter web template:import` em `public/modelos`. */
export const TEMPLATE_FILES = {
  xlsx: '/modelos/modelo-importacao-campeonato.xlsx',
  csv: '/modelos/modelo-importacao-campeonato.csv',
} as const

function csvEscape(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** CSV de uma tabela só (Excel em português, `;` e BOM): inscritos + atributos da categoria. */
export function buildTemplateCsv(): string {
  const categoryByName = new Map(EXAMPLE_CATEGORIES.map((c) => [c[0]!, c]))
  const rows = EXAMPLE_ENTRIES.map((e) => {
    const c = categoryByName.get(e[0]!)
    return [...e, c?.[1] ?? '', c?.[2] ?? '', c?.[3] ?? '', c?.[4] ?? '']
  })
  return '\ufeff' + [[...CSV_COLUMNS], ...rows].map((r) => r.map(csvEscape).join(';')).join('\r\n') + '\r\n'
}
