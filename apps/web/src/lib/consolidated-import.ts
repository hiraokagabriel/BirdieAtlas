import type { ImportCategoryInput, ImportEntryInput } from '@birdie-atlas/validators'
import type { ParsedImport } from './tournament-import'

// Planilha consolidada das federações: uma aba por torneio, uma linha por inscrição, com o código da categoria
// na coluna "Mod/cat." (ex.: SMA, DFSB, DXC, SM Sub 15) e "Nome 1"/"Nome 2" (dupla). Aqui ela vira o mesmo
// formato do modelo (categorias + inscritos) e segue pela verificação normal da API.

type Grid = unknown[][]

const fold = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const text = (v: unknown) => (v === null || v === undefined || v instanceof Date ? '' : String(v).trim())

interface Columns { code: number; n1: number; n2: number; g1: number; g2: number; c1: number; c2: number; rk: number }

function findHeader(grid: Grid): { index: number; cols: Columns } | null {
  for (let index = 0; index < Math.min(grid.length, 40); index++) {
    const cells = (grid[index] ?? []).map(fold)
    const first = (...names: string[]) => cells.findIndex((c) => names.includes(c))
    const code = first('mod cat')
    const n1 = first('nome 1')
    if (code === -1 || n1 === -1) continue
    return { index, cols: { code, n1, n2: first('nome 2'), g1: first('genero 1'), g2: first('genero 2'), c1: first('clube 1', 'entidade'), c2: first('clube 2'), rk: first('rk') } }
  }
  return null
}

export const isConsolidatedGrid = (grid: Grid) => findHeader(grid) !== null

const DISCIPLINES: Record<string, string> = {
  sm: 'Simples Masculino', sf: 'Simples Feminino', dm: 'Duplas Masculinas', df: 'Duplas Femininas', dx: 'Duplas Mistas',
}
const REST = /^(sub(\d+)|senior|veterano|master|mt|s|v|m)?(a|b|c|d|iii|ii|i)?$/
const WORDS: Record<string, string> = { senior: 'Sênior', s: 'Sênior', veterano: 'Veterano', v: 'Veterano', master: 'Master', mt: 'Master', m: 'Master' }

interface ParsedCode { prefix: string; name: string; doubtful: boolean }

/** "DFSB" -> Duplas Femininas Sênior B; "SM Sub 15" -> Simples Masculino Sub 15. Null quando o código é ambíguo ou desconhecido. */
export function parseCategoryCode(raw: string): ParsedCode | null {
  const doubtful = raw.includes('?')
  const f = fold(raw.replace(/\?/g, ' '))
  const m = /^(s|d)(m|f|x)\s*(.*)$/.exec(f)
  if (!m) return null
  const prefix = `${m[1]}${m[2]}`
  const discipline = DISCIPLINES[prefix]
  if (!discipline) return null // simples misto não existe
  const rest = REST.exec((m[3] ?? '').replace(/\s+/g, ''))
  if (!rest) return null
  const word = rest[2] ? `Sub ${rest[2]}` : rest[1] ? WORDS[rest[1]] : undefined
  const level = rest[3]?.toUpperCase()
  const label = [word, level].filter(Boolean).join(' ')
  return { prefix, name: label ? `${discipline} ${label}` : discipline, doubtful }
}

/** Separa "Nome 04 (CLUBE)" em nome, clube e descarta o ano de nascimento que vem colado no nome. */
export function splitPerson(raw: unknown, clubColumn: unknown): { name: string; club: string } {
  let s = text(raw).replace(/\s+/g, ' ')
  let club = text(clubColumn)
  const paren = /\s*\(([^()]+)\)\s*$/.exec(s)
  if (paren) {
    if (!club) club = paren[1]!.trim()
    s = s.slice(0, paren.index).trim()
  }
  return { name: s.replace(/\s+\d{2,4}$/, '').replace(/\s+/g, ' ').trim(), club }
}

const genderOf = (v: unknown): 'M' | 'F' | '' => {
  const f = fold(v)
  return f === 'm' || f === 'masculino' ? 'M' : f === 'f' || f === 'feminino' ? 'F' : ''
}

const SMALL = new Set(['de', 'da', 'do', 'e', 'dos', 'das'])
const titleCase = (s: string) => s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')

/** Converte uma aba consolidada em categorias e inscritos no formato da API. */
export function parseConsolidatedSheet(name: string, grid: Grid): ParsedImport | null {
  const header = findHeader(grid)
  if (!header) return null
  const { cols } = header
  const notes: string[] = []

  interface Row { row: number; cat: ParsedCode; n1: { name: string; club: string }; n2: { name: string; club: string }; g1: 'M' | 'F' | ''; g2: 'M' | 'F' | ''; rk: string }
  const rows: Row[] = []
  const unknown = new Map<string, number>()
  let doubtful = 0

  grid.slice(header.index + 1).forEach((cells, i) => {
    const row = header.index + i + 2
    if (cells.some((c) => fold(c) === 'exemplo')) return
    const code = text(cells[cols.code])
    const n1 = splitPerson(cells[cols.n1], cols.c1 >= 0 ? cells[cols.c1] : '')
    if (!code || fold(code) === 'mod cat' || !n1.name) return
    const cat = parseCategoryCode(code)
    if (!cat) { if (!unknown.has(code)) unknown.set(code, row); return }
    if (cat.doubtful) doubtful++
    rows.push({
      row, cat, n1,
      n2: splitPerson(cols.n2 >= 0 ? cells[cols.n2] : '', cols.c2 >= 0 ? cells[cols.c2] : ''),
      g1: cols.g1 >= 0 ? genderOf(cells[cols.g1]) : '', g2: cols.g2 >= 0 ? genderOf(cells[cols.g2]) : '',
      rk: cols.rk >= 0 ? text(cells[cols.rk]) : '',
    })
  })

  // Sexo conhecido de cada pessoa (coluna de gênero ou modalidade não mista), para completar as duplas mistas.
  const known = new Map<string, 'M' | 'F' | 'conflito'>()
  const learn = (person: string, g: 'M' | 'F' | '') => {
    if (!g || !person) return
    const key = fold(person)
    const old = known.get(key)
    known.set(key, old && old !== g ? 'conflito' : g)
  }
  const prefixGender = (prefix: string): 'M' | 'F' | '' => (prefix[1] === 'm' ? 'M' : prefix[1] === 'f' ? 'F' : '')
  for (const r of rows) {
    const implied = prefixGender(r.cat.prefix)
    learn(r.n1.name, r.g1 || implied)
    learn(r.n2.name, r.g2 || implied)
  }
  const lookup = (person: string): 'M' | 'F' | '' => { const g = known.get(fold(person)); return g === 'M' || g === 'F' ? g : '' }
  const opposite = (g: 'M' | 'F' | '') => (g === 'M' ? 'F' : g === 'F' ? 'M' : '')

  const categories = new Map<string, ImportCategoryInput>()
  const seeds = new Map<string, Set<string>>()
  const entries: ImportEntryInput[] = []
  let inferred = 0
  let droppedSeeds = 0

  for (const r of rows) {
    if (!categories.has(r.cat.name)) {
      categories.set(r.cat.name, { row: r.row, name: r.cat.name, discipline: DISCIPLINES[r.cat.prefix]! })
    }
    const doubles = r.cat.prefix[0] === 'd'
    let g1 = r.g1
    let g2 = r.g2
    if (doubles) {
      const implied = prefixGender(r.cat.prefix)
      g1 ||= implied
      g2 ||= implied
      if (!implied) { // mista: completa pelo que se sabe da pessoa em outras categorias; sem nada conhecido, vale mulher primeiro e homem depois
        const before = `${g1}${g2}`
        g1 ||= lookup(r.n1.name) || opposite(g2 || lookup(r.n2.name))
        g2 ||= lookup(r.n2.name) || opposite(g1)
        if (!g1 && !g2) { g1 = 'F'; g2 = 'M' } // convenção da planilha: mulher primeiro, homem depois
        if (`${g1}${g2}` !== before) { inferred++; learn(r.n1.name, g1); learn(r.n2.name, g2) }
      }
    }

    let seed = ''
    if (/^\d+$/.test(r.rk) && Number(r.rk) > 0) {
      const used = seeds.get(r.cat.name) ?? new Set<string>()
      if (used.has(r.rk)) droppedSeeds++
      else { used.add(r.rk); seeds.set(r.cat.name, used); seed = r.rk }
    }

    entries.push({
      row: r.row,
      category: r.cat.name,
      athlete: r.n1.name,
      ...(doubles && r.n2.name ? { partner: r.n2.name } : {}),
      ...(g1 && (doubles || r.g1) ? { gender: g1 } : {}),
      ...(doubles && g2 ? { partnerGender: g2 } : {}),
      ...(r.n1.club ? { club: r.n1.club } : {}),
      ...(doubles && r.n2.club ? { partnerClub: r.n2.club } : {}),
      ...(seed ? { seed } : {}),
    })
  }

  notes.push(`Planilha consolidada (aba "${name}"): categorias deduzidas do código "Mod/cat."; clube e ano de nascimento separados do nome.`)
  if (inferred > 0) notes.push(`${inferred} dupla${inferred === 1 ? '' : 's'} mista${inferred === 1 ? '' : 's'} com o sexo completado (pelo que a planilha mostra da pessoa em outras categorias ou, sem isso, pela convenção mulher primeiro e homem depois). Confira.`)
  if (doubtful > 0) notes.push(`${doubtful} linha${doubtful === 1 ? '' : 's'} com "?" no código da categoria (dúvida anotada na planilha): lidas sem o "?". Confira.`)
  if (droppedSeeds > 0) notes.push(`${droppedSeeds} cabeça${droppedSeeds === 1 ? '' : 's'} de chave (coluna RK) repetida${droppedSeeds === 1 ? '' : 's'} na mesma categoria: ignorada${droppedSeeds === 1 ? '' : 's'}.`)
  if (unknown.size > 0) {
    const list = [...unknown].slice(0, 8).map(([code, row]) => `"${code}" (linha ${row})`).join(', ')
    notes.push(`Linhas ignoradas por categoria não reconhecida: ${list}${unknown.size > 8 ? ' e outras' : ''}. Corrija o código e leia de novo.`)
  }
  if (categories.size > 60) notes.push(`A aba tem ${categories.size} categorias e o limite é 60 por importação.`)

  return { tournament: { name: titleCase(name), kind: 'Amistoso' }, categories: [...categories.values()], entries, notes }
}

/** Todas as abas consolidadas do arquivo; cada uma é um torneio. */
export function parseConsolidatedWorkbook(sheets: { name: string; grid: Grid }[]): ParsedImport | null {
  const tabs = sheets.flatMap((s) => { const parsed = parseConsolidatedSheet(s.name, s.grid); return parsed && parsed.entries.length > 0 ? [{ name: s.name, parsed }] : [] })
  const first = tabs[0]
  return first ? { ...first.parsed, alternatives: tabs } : null
}
