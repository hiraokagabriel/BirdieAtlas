import { describe, expect, it } from 'vitest'
import { buildTemplateCsv, cellText, EXAMPLE_ENTRIES, fold, parseCsv, parseSheets } from './tournament-import'

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
  it('data vira AAAA-MM-DD local; número, booleano e vazio viram texto', () => {
    expect(cellText(new Date(2026, 10, 5))).toBe('2026-11-05')
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

describe('modelo em CSV', () => {
  it('é lido de volta pelo próprio leitor: categorias e inscritos completos', () => {
    const r = parseSheets([{ name: 'Inscritos', grid: parseCsv(buildTemplateCsv()) }])
    expect(r.entries).toHaveLength(EXAMPLE_ENTRIES.length)
    expect(r.categories.map((c) => c.name)).toEqual(['Simples Masculino', 'Simples Feminino', 'Duplas Masculinas'])
    expect(r.categories.every((c) => c.discipline !== '')).toBe(true)
    expect(r.categories[0]).toMatchObject({ drawType: 'Eliminação simples', maxEntries: '16' })
  })
})

describe('fold', () => {
  it('ignora acento e pontuação', () => {
    expect(fold('Máx. inscrições')).toBe('max inscricoes')
    expect(fold('E-mail do parceiro(a)')).toBe('e mail do parceiro a')
  })
})
