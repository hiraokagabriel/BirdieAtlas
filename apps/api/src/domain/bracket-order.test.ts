import { describe, expect, it } from 'vitest'
import { compareCategoriesForPublication } from './bracket-order.js'

describe('compareCategoriesForPublication', () => {
  it('ordena por disciplina (SM, SF, DM, DF, DX) e depois pelo nome, com números naturais', () => {
    const cats = [
      { discipline: 'XD', name: 'Duplas Mistas A' },
      { discipline: 'WS', name: 'Simples Feminino A' },
      { discipline: 'MS', name: 'Simples Masculino Sub 11' },
      { discipline: 'MS', name: 'Simples Masculino Sub 9' },
      { discipline: 'MD', name: 'Duplas Masculinas A' },
    ]
    expect([...cats].sort(compareCategoriesForPublication).map((c) => c.name)).toEqual([
      'Simples Masculino Sub 9', 'Simples Masculino Sub 11', 'Simples Feminino A', 'Duplas Masculinas A', 'Duplas Mistas A',
    ])
  })
})
