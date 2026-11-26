import { describe, expect, it } from 'vitest'
import type { ImportTournamentInput } from '@birdie-atlas/validators'
import {
  fold,
  parseDate,
  parseDiscipline,
  parseDrawType,
  parseGender,
  parseKind,
  parseLevel,
  parsePositiveInt,
  parseStatus,
  toSlug,
  validateImportInput,
} from './tournament-import.js'

describe('normalizadores', () => {
  it('fold tira acento, pontuação e espaços repetidos', () => {
    expect(fold('  Simples   Masc. ')).toBe('simples masc')
    expect(fold('Eliminação-Simples')).toBe('eliminacao simples')
  })

  it('disciplinas por sigla e por nome em português', () => {
    expect(parseDiscipline('MS')).toBe('MS')
    expect(parseDiscipline('Simples Masculino')).toBe('MS')
    expect(parseDiscipline('simples fem.')).toBe('WS')
    expect(parseDiscipline('Duplas Masculinas')).toBe('MD')
    expect(parseDiscipline('Dupla Feminina')).toBe('WD')
    expect(parseDiscipline('Misto')).toBe('XD')
    expect(parseDiscipline('Veteranos')).toBeNull()
  })

  it('formatos de chave; vazio é eliminação simples', () => {
    expect(parseDrawType('')).toBe('single_elimination')
    expect(parseDrawType(undefined)).toBe('single_elimination')
    expect(parseDrawType('Mata-mata')).toBe('single_elimination')
    expect(parseDrawType('Todos contra todos')).toBe('round_robin')
    expect(parseDrawType('Grupos + eliminatória')).toBe('group_then_elimination')
    expect(parseDrawType('Suíço')).toBe('swiss')
    expect(parseDrawType('Eliminação dupla')).toBe('double_elimination')
    expect(parseDrawType('Pontos corridos')).toBeNull()
  })

  it('tipo, nível, sexo e situação', () => {
    expect(parseKind('')).toBe('official')
    expect(parseKind('Amistoso')).toBe('friendly')
    expect(parseKind('torneio')).toBeNull()
    expect(parseLevel('')).toBe('state')
    expect(parseLevel('Internacional')).toBe('international')
    expect(parseLevel('mundial')).toBeNull()
    expect(parseGender('')).toBeUndefined()
    expect(parseGender('Feminino')).toBe('F')
    expect(parseGender('m')).toBe('M')
    expect(parseGender('x')).toBeNull()
    expect(parseStatus('')).toBe('approved')
    expect(parseStatus('Pendente')).toBe('pending')
    expect(parseStatus('Recusada')).toBe('rejected')
    expect(parseStatus('talvez')).toBeNull()
  })

  it('datas ISO e brasileiras, só do calendário', () => {
    expect(parseDate('2026-11-05')).toBe('2026-11-05')
    expect(parseDate('05/11/2026')).toBe('2026-11-05')
    expect(parseDate('5/1/2026')).toBe('2026-01-05')
    expect(parseDate('30/02/2026')).toBeNull()
    expect(parseDate('amanhã')).toBeNull()
    expect(parseDate('')).toBeNull()
  })

  it('inteiro positivo opcional', () => {
    expect(parsePositiveInt('')).toBeUndefined()
    expect(parsePositiveInt('16')).toBe(16)
    expect(parsePositiveInt('0')).toBeNull()
    expect(parsePositiveInt('1,5')).toBeNull()
  })

  it('slug', () => {
    expect(toSlug('Aberto de Verão 2026!')).toBe('aberto-de-verao-2026')
  })
})

function base(): ImportTournamentInput {
  return {
    dryRun: true,
    tournament: { name: 'Aberto', startDate: '05/11/2026', endDate: '07/11/2026' },
    categories: [
      { row: 2, name: 'Simples A', discipline: 'Simples Masculino', maxEntries: '4' },
      { row: 3, name: 'Duplas', discipline: 'Duplas Femininas', drawType: 'Suíço' },
    ],
    entries: [
      { row: 2, category: 'Simples A', athlete: 'José Silva', gender: 'M', club: 'Clube X' },
      { row: 3, category: 'simples a', athlete: 'João Souza', seed: '1' },
      { row: 4, category: 'Duplas', athlete: 'Ana Lima', partner: 'Bia Costa', gender: 'F', partnerGender: 'F' },
    ],
  }
}

describe('validateImportInput', () => {
  it('planilha válida: normaliza torneio, categorias e inscritos', () => {
    const r = validateImportInput(base())
    expect(r.errors).toEqual([])
    expect(r.tournament).toMatchObject({ name: 'Aberto', kind: 'official', level: 'state', startDate: '2026-11-05', endDate: '2026-11-07' })
    expect(r.categories.map((c) => [c.name, c.discipline, c.drawType, c.maxEntries])).toEqual([
      ['Simples A', 'MS', 'single_elimination', 4],
      ['Duplas', 'WD', 'swiss', null],
    ])
    expect(r.entries).toHaveLength(3)
    expect(r.entries[1]).toMatchObject({ seed: 1, status: 'approved' })
    expect(r.entries[2]!.partner).toMatchObject({ name: 'Bia Costa', gender: 'F' })
  })

  it('simples: o sexo vem da modalidade; em duplas não é deduzido; conflito é erro', () => {
    const input = base()
    input.categories.push({ row: 4, name: 'Simples F', discipline: 'Simples Feminino' })
    input.entries.push(
      { row: 5, category: 'Simples F', athlete: 'Carla Dias' },
      { row: 6, category: 'Simples F', athlete: 'Davi Reis', gender: 'M' },
    )
    const r = validateImportInput(input)
    expect(r.errors.map((e) => `${e.row}:${e.field}`)).toEqual(['6:Sexo'])
    expect(r.entries.find((e) => e.athlete.name === 'João Souza')!.athlete.gender).toBe('M')
    expect(r.entries.find((e) => e.athlete.name === 'Carla Dias')!.athlete.gender).toBe('F')

    const doubles = base()
    doubles.entries = [{ row: 2, category: 'Duplas', athlete: 'Ana Lima', partner: 'Bia Costa' }]
    const d = validateImportInput(doubles)
    expect(d.entries[0]!.athlete.gender).toBeNull()
    expect(d.entries[0]!.partner!.gender).toBeNull()
  })

  it('erros do torneio apontam o campo', () => {
    const input = base()
    input.tournament = { name: '', startDate: '31/02/2026', endDate: '01/01/2026', kind: 'x', level: 'y', slug: 'Slug Ruim', state: 'SPP' }
    const r = validateImportInput(input)
    const fields = r.errors.filter((e) => e.sheet === 'Torneio').map((e) => e.field)
    expect(fields).toEqual(expect.arrayContaining(['Nome', 'Início', 'Tipo', 'Nível', 'Endereço (slug)', 'Estado']))
    expect(r.tournament).toBeNull()
  })

  it('categoria inválida ou repetida', () => {
    const input = base()
    input.categories.push({ row: 4, name: 'simples a', discipline: 'MS' }, { row: 5, name: 'Veteranos', discipline: 'Veteranos' }, { row: 6, name: 'X', discipline: 'MS', drawType: 'Pontos' }, { row: 7, name: 'Y', discipline: 'MS', maxEntries: '-1' })
    const r = validateImportInput(input)
    expect(r.errors.map((e) => `${e.row}:${e.field}`)).toEqual(expect.arrayContaining(['4:Nome', '5:Disciplina', '6:Formato', '7:Máx. inscrições']))
  })

  it('sem categorias é erro', () => {
    const input = base()
    input.categories = []
    input.entries = []
    expect(validateImportInput(input).errors[0]).toMatchObject({ sheet: 'Categorias' })
  })

  it('inscrito: categoria inexistente, parceiro em simples, falta de parceiro em dupla', () => {
    const input = base()
    input.entries = [
      { row: 2, category: 'Não existe', athlete: 'A' },
      { row: 3, category: 'Simples A', athlete: 'B', partner: 'C' },
      { row: 4, category: 'Duplas', athlete: 'D' },
      { row: 5, category: 'Simples A', athlete: '' },
    ]
    const r = validateImportInput(input)
    expect(r.errors.map((e) => `${e.row}:${e.field}`)).toEqual(['2:Categoria', '3:Parceiro(a)', '4:Parceiro(a)', '5:Atleta'])
  })

  it('mesmo atleta duas vezes na categoria e cabeça de chave repetida', () => {
    const input = base()
    input.entries = [
      { row: 2, category: 'Simples A', athlete: 'José Silva', club: 'X', seed: '1' },
      { row: 3, category: 'Simples A', athlete: 'jose silva', club: 'x' },
      { row: 4, category: 'Simples A', athlete: 'Outro', seed: '1' },
    ]
    const r = validateImportInput(input)
    expect(r.errors.map((e) => `${e.row}:${e.field}`)).toEqual(['3:Atleta', '4:Cabeça de chave'])
  })

  it('o mesmo atleta pode estar em categorias diferentes; inscrição recusada não conta como repetida', () => {
    const input = base()
    input.categories = [{ row: 2, name: 'A', discipline: 'MS' }, { row: 3, name: 'B', discipline: 'MS' }]
    input.entries = [
      { row: 2, category: 'A', athlete: 'Zé' },
      { row: 3, category: 'B', athlete: 'Zé' },
      { row: 4, category: 'A', athlete: 'Zé', status: 'Recusada' },
    ]
    expect(validateImportInput(input).errors).toEqual([])
  })

  it('limite de vagas da categoria', () => {
    const input = base()
    input.categories = [{ row: 2, name: 'A', discipline: 'MS', maxEntries: '1' }]
    input.entries = [{ row: 2, category: 'A', athlete: 'X' }, { row: 3, category: 'A', athlete: 'Y' }]
    expect(validateImportInput(input).errors[0]).toMatchObject({ field: 'Categoria', message: expect.stringContaining('limite de 1') })
  })

  it('parceiro igual ao atleta é erro; categoria sem inscritos gera aviso', () => {
    const input = base()
    input.entries = [{ row: 2, category: 'Duplas', athlete: 'Ana', partner: 'ana', gender: 'F' }]
    const r = validateImportInput(input)
    expect(r.errors[0]).toMatchObject({ field: 'Parceiro(a)' })
    expect(r.warnings.some((w) => w.message.includes('não tem nenhum inscrito'))).toBe(true)
  })
})

describe('importação para torneio existente', () => {
  const existing = [
    { id: 'cat-sm', name: 'Simples Masculino A', discipline: 'MS' as const, drawType: 'round_robin' as const, maxEntries: 8, scoring: { pointsPerSet: 15, setPointCap: 21, setsToWin: 2 } },
    { id: 'cat-sf', name: 'Simples Feminino A', discipline: 'WS' as const, drawType: 'single_elimination' as const, maxEntries: null, scoring: { pointsPerSet: 21, setPointCap: 30, setsToWin: 2 }, locked: true },
  ]
  const entry = (row: number, category: string, athlete: string) => ({ row, category, athlete })

  it('inscritos podem apontar para categoria só da plataforma, que mantém a configuração', () => {
    const v = validateImportInput({ dryRun: true, categories: [], entries: [entry(2, 'simples masculino a', 'João Silva')] }, existing)
    expect(v.errors).toEqual([])
    expect(v.categories[0]).toMatchObject({ existingId: 'cat-sm', drawType: 'round_robin', maxEntries: 8 })
  })

  it('mesmo nome na aba Categorias reaproveita a da plataforma; outra disciplina é erro', () => {
    const ok = validateImportInput({ dryRun: true, categories: [{ row: 2, name: 'Simples Masculino A', discipline: 'MS', maxEntries: '32' }], entries: [] }, existing)
    expect(ok.categories[0]?.existingId).toBe('cat-sm')
    expect(ok.categories[0]?.maxEntries).toBe(8)
    const bad = validateImportInput({ dryRun: true, categories: [{ row: 2, name: 'Simples Masculino A', discipline: 'WS' }], entries: [] }, existing)
    expect(bad.errors[0]?.field).toBe('Disciplina')
  })

  it('categoria com chave sorteada não recebe inscrição', () => {
    const v = validateImportInput({ dryRun: true, categories: [], entries: [entry(2, 'Simples Feminino A', 'Ana Souza')] }, existing)
    expect(v.errors[0]?.message).toMatch(/chave sorteada/)
  })

  it('categoria nova com pontuação de 15; pontuação inválida é erro', () => {
    const v = validateImportInput({ dryRun: true, categories: [{ row: 2, name: 'Duplas Mistas B', discipline: 'XD', scoring: '15' }], entries: [] }, existing)
    expect(v.categories[0]?.scoring).toEqual({ pointsPerSet: 15, setPointCap: 21, setsToWin: 2 })
    const bad = validateImportInput({ dryRun: true, categories: [{ row: 2, name: 'Duplas Mistas B', discipline: 'XD', scoring: '17' }], entries: [] }, existing)
    expect(bad.errors[0]?.field).toBe('Pontuação')
  })
})

describe('importação para torneio existente (CSV sem aba Categorias)', () => {
  it('categoria da plataforma com disciplina em branco é reaproveitada', () => {
    const existing = [{ id: 'c1', name: 'Simples A', discipline: 'MS' as const, drawType: 'single_elimination' as const, maxEntries: null, scoring: { pointsPerSet: 21, setPointCap: 30, setsToWin: 2 } }]
    const v = validateImportInput({ dryRun: true, categories: [{ row: 2, name: 'Simples A', discipline: '' }], entries: [{ row: 2, category: 'Simples A', athlete: 'João Silva' }] }, existing)
    expect(v.errors).toEqual([])
    expect(v.categories[0]?.existingId).toBe('c1')
  })
})

describe('importação para torneio existente (revisão)', () => {
  const rule = { pointsPerSet: 21, setPointCap: 30, setsToWin: 2 }
  it('categoria existente ignora formato e pontuação inválidos da planilha (vale a de lá)', () => {
    const existing = [{ id: 'c1', name: 'Simples A', discipline: 'MS' as const, drawType: 'single_elimination' as const, maxEntries: null, scoring: rule }]
    const v = validateImportInput({ dryRun: true, categories: [{ row: 2, name: 'Simples A', discipline: 'MS', drawType: 'xyz', scoring: '99' }], entries: [] }, existing)
    expect(v.errors).toEqual([])
    expect(v.categories[0]?.existingId).toBe('c1')
  })
  it('duas categorias do torneio com o mesmo nome (acento) são ambíguas', () => {
    const existing = [
      { id: 'c1', name: 'Simples Júnior', discipline: 'MS' as const, drawType: 'single_elimination' as const, maxEntries: null, scoring: rule },
      { id: 'c2', name: 'Simples Junior', discipline: 'MS' as const, drawType: 'single_elimination' as const, maxEntries: null, scoring: rule },
    ]
    const v = validateImportInput({ dryRun: true, categories: [], entries: [{ row: 2, category: 'simples junior', athlete: 'João Silva' }] }, existing)
    expect(v.errors[0]?.message).toMatch(/duas categorias/)
  })
})
