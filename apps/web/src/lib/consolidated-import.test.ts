import { describe, expect, it } from 'vitest'
import { parseCategoryCode, parseConsolidatedSheet, splitPerson } from './consolidated-import'
import { parseSheets } from './tournament-import'

describe('parseCategoryCode', () => {
  it('disciplina, faixa e nível', () => {
    expect(parseCategoryCode('SMA')?.name).toBe('Simples Masculino A')
    expect(parseCategoryCode('DFSB')?.name).toBe('Duplas Femininas Sênior B')
    expect(parseCategoryCode('DXVC')?.name).toBe('Duplas Mistas Veterano C')
    expect(parseCategoryCode('DMMB')?.name).toBe('Duplas Masculinas Master B')
    expect(parseCategoryCode('DFMtI')?.name).toBe('Duplas Femininas Master I')
    expect(parseCategoryCode('DMMtII')?.name).toBe('Duplas Masculinas Master II')
  })

  it('variantes de grafia caem na mesma categoria', () => {
    const names = ['SM Sub 13', 'SM Sub13', 'SMsub13', 'SMSub13'].map((c) => parseCategoryCode(c)?.name)
    expect(new Set(names)).toEqual(new Set(['Simples Masculino Sub 13']))
    expect(parseCategoryCode('DMVeterano')?.name).toBe('Duplas Masculinas Veterano')
    expect(parseCategoryCode('SM Sênior')?.name).toBe('Simples Masculino Sênior')
    expect(parseCategoryCode('DX Master')?.name).toBe('Duplas Mistas Master')
  })

  it('"?" é dúvida anotada; ambíguo ou desconhecido é null', () => {
    expect(parseCategoryCode('DFSC ??')).toMatchObject({ name: 'Duplas Femininas Sênior C', doubtful: true })
    expect(parseCategoryCode('DXB ????')?.name).toBe('Duplas Mistas B')
    expect(parseCategoryCode('DF/DX')).toBeNull()
    expect(parseCategoryCode('DM ou DX Sub 15')).toBeNull()
    expect(parseCategoryCode('SXA')).toBeNull()
    expect(parseCategoryCode('Livre')).toBeNull()
  })
})

describe('splitPerson', () => {
  it('clube entre parênteses e ano de nascimento saem do nome', () => {
    expect(splitPerson('Alonso Medel 01(FON)', null)).toEqual({ name: 'Alonso Medel', club: 'FON' })
    expect(splitPerson('Elisabete Shintate 68 (SOGO)', '')).toEqual({ name: 'Elisabete Shintate', club: 'SOGO' })
    expect(splitPerson('Bruna Maeda (ACE)', 'ACE')).toEqual({ name: 'Bruna Maeda', club: 'ACE' })
    expect(splitPerson('Ana  Lima', 'ACBB')).toEqual({ name: 'Ana Lima', club: 'ACBB' })
  })
})

const HEADER = ['Mod/cat.', 'RK', 'Remanej.', 'Nome 1', 'GENERO 1', 'CLUBE 1', 'ANO 1', 'Nome 2', 'GENERO 2', 'CLUBE 2', 'ANO 2']

describe('parseConsolidatedSheet', () => {
  it('layout com gênero e clube em colunas (Intercolonial)', () => {
    const grid = [
      HEADER,
      ['DFA', null, null, 'Geovanna Tanaka', 'F', 'MOGI', '2010.', 'Ana Noda', 'F', 'MOGI', '2011.'],
      ['DFA', 1, null, 'Luana Tamayose', 'F', 'AASC', null, 'Melissa Tamayose', 'F', 'AASC', null],
      ['DFA', 1, null, 'Mariana Jin', 'F', 'ACBB', null, 'Isabela Noda', 'F', 'ZZZ', null],
      ['DX Sub 13', null, null, 'Ana Lima', 'F', 'ACE', null, 'Davi Reis', 'M', 'ACE', null],
    ]
    const r = parseConsolidatedSheet('INTERCOLONIAL ABERTO E SUB', grid)!
    expect(r.tournament).toEqual({ name: 'Intercolonial Aberto e Sub', kind: 'Amistoso' })
    expect(r.categories.map((c) => [c.name, c.discipline])).toEqual([['Duplas Femininas A', 'Duplas Femininas'], ['Duplas Mistas Sub 13', 'Duplas Mistas']])
    expect(r.entries[0]).toMatchObject({ row: 2, category: 'Duplas Femininas A', athlete: 'Geovanna Tanaka', partner: 'Ana Noda', gender: 'F', partnerGender: 'F', club: 'MOGI', partnerClub: 'MOGI' })
    expect(r.entries[1]!.seed).toBe('1')
    expect(r.entries[2]!.seed).toBeUndefined() // RK repetido na categoria
    expect(r.notes.some((n) => n.includes('repetida'))).toBe(true)
  })

  it('layout com clube dentro do nome, exemplo ignorado, sexo deduzido pelo código e completado nas mistas', () => {
    const grid: unknown[][] = [
      ['x'],
      [null, null, 'Chave', 'Mod/cat.', 'Nome 1', 'Nome 2', 'Entidade'],
      [null, 'EXEMPLO', 1, 'DFSB', 'Fulana Exemplo', 'Outra', 'ZZZ'],
      [null, null, 1, 'SMA', 'Augusto Franzoni 04 (SME)', null, 'SME Mococa'],
      [null, null, 2, 'DFSC ??', 'Ana Lima', 'Bia Costa', 'ACE'],
      [null, null, 3, 'DXB', 'Ana Lima', 'Davi Reis', 'ACE'], // Ana é F pelo DF: Davi vira M
      [null, null, 4, 'DXB', 'Eva Souza', 'Davi Reis', 'ACE'], // Davi é M só pela linha anterior: Eva vira F
      [null, null, 5, 'DXB', 'Fulano X', 'Fulana Y', 'ACE'], // ninguém conhecido: mulher primeiro, homem depois
      [null, null, 6, 'DF/DX', 'Gui', 'Hugo', 'ACE'],
    ]
    const r = parseConsolidatedSheet('COPA X', grid)!
    expect(r.entries).toHaveLength(5)
    expect(r.entries[0]).toMatchObject({ row: 4, category: 'Simples Masculino A', athlete: 'Augusto Franzoni', club: 'SME Mococa' })
    expect(r.entries[0]!.gender).toBeUndefined() // simples: a API deduz
    expect(r.entries[1]).toMatchObject({ category: 'Duplas Femininas Sênior C', gender: 'F', partnerGender: 'F' })
    expect(r.entries[2]).toMatchObject({ gender: 'F', partnerGender: 'M' })
    expect(r.entries[3]).toMatchObject({ athlete: 'Eva Souza', gender: 'F', partnerGender: 'M' })
    expect(r.entries[4]).toMatchObject({ gender: 'F', partnerGender: 'M' })
    expect(r.notes.join(' ')).toContain('DF/DX')
    expect(r.notes.join(' ')).toContain('"?"')
  })

  it('mesmo nome com clubes diferentes ou ausente vira uma pessoa só, com o clube mais citado', () => {
    const r = parseConsolidatedSheet('T', [
      HEADER,
      ['SMA', null, null, 'Cris Sales', 'F', 'BUNKA SBC/BZN', null, null, null, null, null],
      ['SMB', null, null, 'Cris Sales', 'F', 'BUNKA SBC/NCC', null, null, null, null, null],
      ['SFC', null, null, 'Cris Sales', 'F', 'BUNKA SBC/BZN', null, null, null, null, null],
      ['SFD', null, null, 'Cris Sales', 'F', null, null, null, null, null, null],
    ])!
    expect(r.entries.map((e) => e.club)).toEqual(Array(4).fill('BUNKA SBC/BZN'))
    expect(r.notes.some((n) => n.includes('mesma pessoa'))).toBe(true)
  })

  it('Entidade sem clube do parceiro vale para a dupla toda (mesmo parceiro em duplas de clubes diferentes é uma pessoa só)', () => {
    const r = parseConsolidatedSheet('T', [
      ['Chave', 'Mod/cat.', 'Nome 1', 'Nome 2', 'Entidade'],
      [1, 'DMA', 'Fernando Huang', 'Kaique Yu', 'BZN/USP'],
      [2, 'DMB', 'Leticia Dietrich', 'Kaique Yu', 'BZN/USP'],
      [3, 'DMC', 'Outro Cara', 'Kaique Yu', 'BZN'],
    ])!
    expect(r.entries.map((e) => e.partnerClub)).toEqual(['BZN/USP', 'BZN/USP', 'BZN/USP'])
  })

  it('parceiro sem clube herda o do atleta antes de unificar (mesmo parceiro, uma pessoa só)', () => {
    const r = parseConsolidatedSheet('T', [
      HEADER,
      ['DMA', null, null, 'Jorge', 'M', 'SUGIURA', null, 'Marcelo', 'M', null, null],
      ['DXA', null, null, 'Claudia', 'F', null, null, 'Marcelo', 'M', null, null],
    ])!
    expect(r.entries.map((e) => e.partnerClub)).toEqual(['SUGIURA', 'SUGIURA'])
  })

  it('parseSheets usa o modo consolidado e lista as abas', () => {
    const r = parseSheets([
      { name: 'ABA 1', grid: [HEADER, ['SMA', null, null, 'Ana', 'F', 'X', null, null, null, null, null]] },
      { name: 'Sem dados', grid: [['nada']] },
      { name: 'ABA 2', grid: [HEADER, ['SFA', null, null, 'Bia', 'F', 'Y', null, null, null, null, null]] },
    ])
    expect(r.alternatives?.map((a) => a.name)).toEqual(['ABA 1', 'ABA 2'])
    expect(r.entries[0]!.athlete).toBe('Ana')
    expect(r.alternatives?.[1]?.parsed.entries[0]!.athlete).toBe('Bia')
  })

  it('planilha do modelo não é tratada como consolidada', () => {
    const r = parseSheets([{ name: 'Inscritos', grid: [['Categoria', 'Atleta'], ['A', 'Ana']] }])
    expect(r.alternatives).toBeUndefined()
    expect(r.entries).toHaveLength(1)
  })
})
