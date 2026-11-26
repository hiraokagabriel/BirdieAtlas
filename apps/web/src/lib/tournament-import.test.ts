import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { buildTemplateCsv, cellText, EXAMPLE_ENTRIES, fold, parseCsv, parseSheets, TEMPLATE_FILES } from './tournament-import'

describe('parseCsv', () => {
  it('separador ; (Excel pt-BR), aspas, quebra de linha dentro de campo e BOM', () => {
    const rows = parseCsv('﻿Categoria;Atleta\r\n"Simples; A";"Zé ""Zeca"" Silva"\r\nB;"linha 1\nlinha 2"\r\n')
    expect(rows).toEqual([['Categoria', 'Atleta'], ['Simples; A', 'Zé "Zeca" Silva'], ['B', 'linha 1\nlinha 2']])
  })

  it('separador vírgula e linhas vazias ignoradas', () => {
    expect(parseCsv('a,b\n1,2\n\n,\n3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })
})

describe('cellText', () => {
  it('data (meia-noite UTC, como o leitor de XLSX entrega) vira AAAA-MM-DD do mesmo dia; número, booleano e vazio viram texto', () => {
    expect(cellText(new Date(Date.UTC(2026, 10, 5)))).toBe('2026-11-05')
    expect(cellText(new Date('2026-12-05T00:00:00.000Z'))).toBe('2026-12-05')
    expect(cellText(16)).toBe('16')
    expect(cellText(true)).toBe('Sim')
    expect(cellText(null)).toBe('')
    expect(cellText('  x ')).toBe('x')
  })
})

describe('parseSheets', () => {
  it('CSV de uma tabela: deduz as categorias dos atributos da primeira linha', () => {
    const grid = parseCsv(
      'Categoria;Atleta;Parceiro(a);Sexo;Clube;Disciplina;Formato;Máx. inscrições\n' +
        'Simples A;José;;M;Clube X;Simples Masculino;Suíço;8\n' +
        'Simples A;João;;M;;;;\n' +
        'Duplas;Ana;Bia;F;;Duplas Femininas;;\n',
    )
    const r = parseSheets([{ name: 'Inscritos', grid }])
    expect(r.categories).toEqual([
      { row: 2, name: 'Simples A', discipline: 'Simples Masculino', drawType: 'Suíço', maxEntries: '8' },
      { row: 4, name: 'Duplas', discipline: 'Duplas Femininas' },
    ])
    expect(r.entries).toHaveLength(3)
    expect(r.entries[0]).toMatchObject({ row: 2, category: 'Simples A', athlete: 'José', gender: 'M', club: 'Clube X' })
    expect(r.entries[2]).toMatchObject({ partner: 'Bia' })
    expect(r.notes.some((n) => n.includes('deduzidas'))).toBe(true)
  })

  it('XLSX com abas: torneio em campo/valor, categorias e inscritos; cabeçalhos com outra grafia', () => {
    const r = parseSheets([
      { name: 'Instruções', grid: [['texto']] },
      { name: 'Torneio', grid: [['Campo', 'Valor'], ['Nome', 'Aberto'], ['Início', new Date(2026, 10, 15)], ['Término', '17/11/2026'], ['Tipo', 'Amistoso'], ['Endereço (slug)', 'aberto-x']] },
      { name: 'Categorias', grid: [['Nome', 'Disciplina', 'Formato', 'Máx. inscrições'], ['Misto', 'Misto', 'Eliminação dupla', 12]] },
      { name: 'Inscritos', grid: [['categoria', 'ATLETA', 'parceiro', 'cabeca de chave', 'Coluna extra'], ['Misto', 'Ana', 'João', 1, 'x']] },
    ])
    expect(r.tournament).toEqual({ name: 'Aberto', startDate: '2026-11-15', endDate: '17/11/2026', kind: 'Amistoso', slug: 'aberto-x' })
    expect(r.categories).toEqual([{ row: 2, name: 'Misto', discipline: 'Misto', drawType: 'Eliminação dupla', maxEntries: '12' }])
    expect(r.entries[0]).toMatchObject({ row: 2, category: 'Misto', athlete: 'Ana', partner: 'João', seed: '1' })
    expect(r.notes.some((n) => n.includes('Coluna extra'))).toBe(true)
  })

  it('sem aba de inscritos (várias abas e nenhuma reconhecida) avisa', () => {
    const r = parseSheets([{ name: 'A', grid: [] }, { name: 'B', grid: [] }])
    expect(r.entries).toEqual([])
    expect(r.notes[0]).toContain('Inscritos')
  })
})

describe('modelo', () => {
  it('CSV: os exemplos são ignorados e o resto da linha vira a categoria', () => {
    const csv = buildTemplateCsv()
    const exemplo = parseSheets([{ name: 'Inscritos', grid: parseCsv(csv) }])
    expect(exemplo.entries).toEqual([])
    expect(exemplo.notes[0]).toBe(`${EXAMPLE_ENTRIES.length} linhas de exemplo ignoradas.`)

    // Preenchido por cima dos exemplos: categoria com disciplina, formato, limite e pontuação.
    const filled = csv.replaceAll('Exemplo ', '')
    const r = parseSheets([{ name: 'Inscritos', grid: parseCsv(filled) }])
    expect(r.entries).toHaveLength(EXAMPLE_ENTRIES.length)
    expect(r.categories[0]).toMatchObject({ name: 'Simples Masculino A', discipline: 'Simples Masculino', drawType: 'Eliminação simples', maxEntries: '16', scoring: '21' })
    expect(r.categories[1]).toMatchObject({ name: 'Duplas Mistas', discipline: 'Misto', scoring: '15' })
  })

  it('XLSX versionado em public/modelos é lido pelo próprio leitor', async () => {
    const { default: readExcelFile } = await import('read-excel-file/node')
    const path = fileURLToPath(new URL(`../../public${TEMPLATE_FILES.xlsx}`, import.meta.url))
    const sheets = await readExcelFile(path)
    expect(sheets.map((x) => x.sheet)).toEqual(['Instruções', 'Categorias', 'Inscritos'])
    const r = parseSheets(sheets.map((x) => ({ name: x.sheet, grid: x.data as unknown[][] })))
    expect(r.categories).toEqual([])
    expect(r.entries).toEqual([])
    expect(r.notes[0]).toBe(`${EXAMPLE_ENTRIES.length} linhas de exemplo ignoradas.`)
  })
})

describe('fold', () => {
  it('ignora acento e pontuação', () => {
    expect(fold('Máx. inscrições')).toBe('max inscricoes')
    expect(fold('E-mail do parceiro(a)')).toBe('e mail do parceiro a')
  })
})

describe('linhas de exemplo', () => {
  it('só os pares exatos do modelo são ignorados; nome real parecido entra', () => {
    const grid = [
      ['Categoria', 'Atleta'],
      ['Exemplo Simples Masculino A', 'Exemplo Carlos Almeida'],
      ['Exemplo Sub-15', 'Exemplo Silva'],
    ]
    const r = parseSheets([{ name: 'Inscritos', grid }])
    expect(r.entries.map((e) => e.athlete)).toEqual(['Exemplo Silva'])
  })
})
