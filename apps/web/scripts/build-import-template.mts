// Gera os modelos de importação em public/modelos (versionados): `pnpm --filter web template:import`.
// O conteúdo (colunas, opções, exemplos e instruções) vem de src/lib/tournament-import.ts, a mesma fonte que lê a
// planilha. Rode de novo sempre que mudar uma coluna ou opção ali.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import {
  CATEGORY_COLUMNS, ENTRY_COLUMNS, EXAMPLE_CATEGORIES, EXAMPLE_ENTRIES, TEMPLATE_FILES, TEMPLATE_INSTRUCTIONS, TEMPLATE_OPTIONS,
  buildTemplateCsv,
} from '../src/lib/tournament-import'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// Cores da marca (verde-quadra) em hex: o Excel não entende oklch.
const GREEN = 'FF0B703F' // court-green
const GREEN_SOFT = 'FFE5F3E4' // court-green-mist
const EXAMPLE_FILL = 'FFF4F4F1'
const EXAMPLE_TEXT = 'FF6B6F6A'
const ROWS = 500 // linhas com lista de opções

const wb = new ExcelJS.Workbook()
wb.creator = 'BirdieAtlas'

// ----- Instruções
const info = wb.addWorksheet('Instruções', { views: [{ showGridLines: false }], properties: { tabColor: { argb: 'FF8A8F88' } } })
info.getColumn(1).width = 4
info.getColumn(2).width = 110
const [title, ...lines] = TEMPLATE_INSTRUCTIONS
info.addRow([])
const t = info.addRow(['', title])
t.getCell(2).font = { bold: true, size: 16, color: { argb: GREEN } }
t.height = 26
info.addRow([])
for (const line of lines) {
  // Marcador na coluna A: a linha quebrada continua alinhada ao texto.
  const r = info.addRow(['•', line])
  r.getCell(1).alignment = { horizontal: 'right', vertical: 'top' }
  r.getCell(1).font = { color: { argb: GREEN }, bold: true }
  r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  r.height = Math.ceil(line.length / 100) * 16 + 4
}

/** Aba de tabela: cabeçalho verde fixo, larguras, exemplos em cinza e listas de opções. */
function tableSheet(name: string, columns: readonly string[], widths: number[], examples: string[][], hint: string) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: GREEN } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' },
  })
  ws.columns = columns.map((header, i) => ({ header, width: widths[i] ?? 18 }))
  const head = ws.getRow(1)
  head.height = 32
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  head.getCell(1).note = hint
  for (const values of examples) {
    const row = ws.addRow(values)
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { italic: true, color: { argb: EXAMPLE_TEXT } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXAMPLE_FILL } }
    })
  }
  // Faixa clara a cada linha par (até onde há lista), para facilitar a leitura.
  for (let r = examples.length + 2; r <= ROWS; r += 2) {
    for (let c = 1; c <= columns.length; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SOFT } }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return ws
}

function list(ws: ExcelJS.Worksheet, column: number, options: readonly string[] | string, prompt: string, strict = true) {
  const formulae = typeof options === 'string' ? [options] : [`"${options.join(',')}"`]
  for (let r = 2; r <= ROWS; r++) {
    ws.getCell(r, column).dataValidation = {
      type: 'list', allowBlank: true, formulae,
      showInputMessage: true, promptTitle: 'Escolha', prompt,
      showErrorMessage: true, errorStyle: strict ? 'stop' : 'warning', errorTitle: 'Valor fora da lista', error: prompt,
    }
  }
}

function positive(ws: ExcelJS.Worksheet, column: number, prompt: string) {
  for (let r = 2; r <= ROWS; r++) {
    ws.getCell(r, column).dataValidation = {
      type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [1],
      showErrorMessage: true, errorTitle: 'Número inválido', error: prompt, showInputMessage: true, prompt,
    }
  }
}

// ----- Categorias
const cats = tableSheet('Categorias', CATEGORY_COLUMNS, [34, 22, 26, 16, 14], EXAMPLE_CATEGORIES, 'Uma linha por categoria. As linhas de exemplo (em cinza) são ignoradas.')
list(cats, 2, TEMPLATE_OPTIONS.discipline, 'Simples Masculino, Simples Feminino, Duplas Masculinas, Duplas Femininas ou Misto.')
list(cats, 3, TEMPLATE_OPTIONS.drawType, 'Em branco: Eliminação simples.')
positive(cats, 4, 'Opcional: número máximo de inscrições.')
list(cats, 5, TEMPLATE_OPTIONS.scoring, '21 = 21 pontos (teto 30); 15 = 15 pontos (teto 21); 11 = 11 pontos, melhor de 5. Em branco: 21.')

// ----- Inscritos
const ins = tableSheet('Inscritos', ENTRY_COLUMNS, [34, 30, 30, 8, 20, 24, 24, 16, 14], EXAMPLE_ENTRIES, 'Uma linha por inscrição. Duplas: preencha Parceiro(a). As linhas de exemplo (em cinza) são ignoradas.')
// Categoria: sugere as da aba Categorias, mas aceita outra (pode ser uma categoria criada só na plataforma).
list(ins, 1, `Categorias!$A$2:$A$${ROWS}`, 'Categoria da aba Categorias ou já criada na plataforma.', false)
list(ins, 4, TEMPLATE_OPTIONS.gender, 'M ou F. Em Simples pode ficar em branco.')
list(ins, 5, TEMPLATE_OPTIONS.gender, 'M ou F (só em duplas).')
positive(ins, 8, 'Opcional: 1, 2, 3...')
list(ins, 9, TEMPLATE_OPTIONS.status, 'Em branco: Aprovada.')

wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]

mkdirSync(join(PUBLIC, 'modelos'), { recursive: true })
await wb.xlsx.writeFile(join(PUBLIC, TEMPLATE_FILES.xlsx))
writeFileSync(join(PUBLIC, TEMPLATE_FILES.csv), buildTemplateCsv(), 'utf8')
console.log(`Modelos gravados em public${TEMPLATE_FILES.xlsx} e public${TEMPLATE_FILES.csv}`)
