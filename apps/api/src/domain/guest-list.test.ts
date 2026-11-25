import { describe, expect, it } from 'vitest'
import { gendersForDiscipline, matchGuest, parseGuestList, type GuestCandidate } from './guest-list.js'

describe('parseGuestList', () => {
  it('lê simples: um nome por linha, ignora linhas vazias e tira o gênero da categoria', () => {
    const { entries, errors } = parseGuestList('Ana Souza\n\n  Bia   Lima  \n', 'WS')
    expect(errors).toEqual([])
    expect(entries).toEqual([
      { line: 1, players: [{ name: 'Ana Souza', birthYear: null, gender: 'F' }] },
      { line: 3, players: [{ name: 'Bia Lima', birthYear: null, gender: 'F' }] },
    ])
  })

  it('lê duplas com "/" e, na mista, o 1º é homem e o 2º mulher', () => {
    const { entries } = parseGuestList('Carlos Dias / Ana Souza', 'XD')
    expect(entries[0]!.players.map((p) => [p.name, p.gender])).toEqual([['Carlos Dias', 'M'], ['Ana Souza', 'F']])
  })

  it('aceita o ano entre parênteses e recusa ano fora do intervalo', () => {
    const ok = parseGuestList('Ana Souza (2001)', 'WS', 2026)
    expect(ok.entries[0]!.players[0]).toEqual({ name: 'Ana Souza', birthYear: 2001, gender: 'F' })
    const bad = parseGuestList('Ana Souza (2030)', 'WS', 2026)
    expect(bad.errors).toEqual([{ line: 1, message: '"Ana Souza": ano de nascimento 2030 fora do intervalo.' }])
  })

  it('aponta a linha dos erros: sobrenome faltando, dupla sem "/", simples com "/", nome repetido', () => {
    expect(parseGuestList('Ana', 'WS').errors[0]).toEqual({ line: 1, message: '"Ana": informe nome e sobrenome.' })
    expect(parseGuestList('Ana Souza', 'WD').errors[0]!.message).toMatch(/separados por "\/"/)
    expect(parseGuestList('Ana Souza / Bia Lima', 'WS').errors[0]!.message).toMatch(/um nome por linha/)
    expect(parseGuestList('Ana Souza\nana  souza', 'WS').errors).toEqual([{ line: 2, message: 'ana souza já está na linha 1.' }])
    expect(parseGuestList('Ana Souza / Ana Souza', 'WD').errors[0]!.message).toBe('A dupla repete o mesmo nome.')
  })

  it('o nome repetido conta também entre duplas da mesma categoria', () => {
    const { errors } = parseGuestList('Ana Souza / Bia Lima\nCaio Reis / Bia Lima', 'XD')
    expect(errors).toHaveLength(1)
  })

  it('recusa lista grande demais', () => {
    const text = Array.from({ length: 300 }, (_, i) => `Pessoa Numero${i}`).join('\n')
    expect(parseGuestList(text, 'MS').errors[0]!.message).toMatch(/mais de 256/)
  })
})

describe('gendersForDiscipline', () => {
  it('cobre as cinco disciplinas', () => {
    expect(['MS', 'WS', 'MD', 'WD', 'XD'].map(gendersForDiscipline)).toEqual([['M'], ['F'], ['M', 'M'], ['F', 'F'], ['M', 'F']])
  })
})

describe('matchGuest', () => {
  const ana = (id: string, birthYear: number | null): GuestCandidate => ({ id, name: 'Ana Souza', gender: 'F', birthYear })

  it('reaproveita o avulso de mesmo nome, ignorando acento e caixa', () => {
    expect(matchGuest([{ id: 'a', name: 'José Ávila', gender: 'M', birthYear: null }], { name: 'jose avila', birthYear: null, gender: 'M' })?.id).toBe('a')
  })

  it('gênero diferente não casa', () => {
    expect(matchGuest([ana('a', null)], { name: 'Ana Souza', birthYear: null, gender: 'M' })).toBeNull()
  })

  it('anos conhecidos e diferentes são homônimos; ano desconhecido de um lado casa', () => {
    expect(matchGuest([ana('a', 2000)], { name: 'Ana Souza', birthYear: 2001, gender: 'F' })).toBeNull()
    expect(matchGuest([ana('a', null)], { name: 'Ana Souza', birthYear: 2001, gender: 'F' })?.id).toBe('a')
    expect(matchGuest([ana('a', 2000)], { name: 'Ana Souza', birthYear: null, gender: 'F' })?.id).toBe('a')
  })

  it('entre vários, prefere o de mesmo ano; sem ano, o primeiro (mais antigo)', () => {
    const list = [ana('velho', null), ana('certo', 2001)]
    expect(matchGuest(list, { name: 'Ana Souza', birthYear: 2001, gender: 'F' })?.id).toBe('certo')
    expect(matchGuest(list, { name: 'Ana Souza', birthYear: null, gender: 'F' })?.id).toBe('velho')
  })
})
