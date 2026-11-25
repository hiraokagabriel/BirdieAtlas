import { describe, expect, it } from 'vitest'
import { checkGuestMerge, planPairMerge, sharedCategories, type MergePair } from './guest-merge.js'

const pair = (p: Omit<MergePair, 'deleted' | 'active'> & Partial<MergePair>): MergePair => ({ deleted: false, active: true, ...p })

const guest = { id: 'g', guest: true, gender: 'M' as const }
const athlete = { id: 'a', guest: false, gender: 'M' as const }

describe('checkGuestMerge', () => {
  it('aceita avulso → cadastrado do mesmo gênero', () => {
    expect(checkGuestMerge(guest, athlete)).toBeNull()
  })

  it('recusa origem cadastrada, destino avulso, mesma pessoa e gênero diferente', () => {
    expect(checkGuestMerge(athlete, { ...athlete, id: 'b' })?.code).toBe('ATHLETE_NOT_GUEST')
    expect(checkGuestMerge(guest, { ...guest, id: 'h' })?.code).toBe('TARGET_IS_GUEST')
    expect(checkGuestMerge(guest, guest)?.code).toBe('SAME_ATHLETE')
    expect(checkGuestMerge(guest, { ...athlete, gender: 'F' })).toMatchObject({ status: 422, code: 'GENDER_MISMATCH' })
  })
})

describe('planPairMerge', () => {
  it('troca o avulso na própria dupla, no lado em que ele está', () => {
    const { steps, conflict } = planPairMerge([
      pair({ id: 'p1', athlete1Id: 'g', athlete2Id: 'x', discipline: 'MD' }),
      pair({ id: 'p2', athlete1Id: 'y', athlete2Id: 'g', discipline: 'XD' }),
    ], 'g', 'a')
    expect(conflict).toBe(false)
    expect(steps).toEqual([
      { pairId: 'p1', action: 'update', column: 'athlete1Id' },
      { pairId: 'p2', action: 'update', column: 'athlete2Id' },
    ])
  })

  it('reaproveita a dupla que o atleta já tem com o mesmo parceiro na mesma disciplina', () => {
    const { steps } = planPairMerge([
      pair({ id: 'p1', athlete1Id: 'g', athlete2Id: 'x', discipline: 'MD' }),
      pair({ id: 'p9', athlete1Id: 'x', athlete2Id: 'a', discipline: 'MD' }),
      pair({ id: 'p8', athlete1Id: 'a', athlete2Id: 'x', discipline: 'XD' }),
    ], 'g', 'a')
    expect(steps).toEqual([{ pairId: 'p1', action: 'reuse', intoPairId: 'p9' }])
  })

  it('não reaproveita dupla inativa ou excluída do atleta; dupla excluída do avulso só troca o atleta', () => {
    const { steps } = planPairMerge([
      pair({ id: 'p1', athlete1Id: 'g', athlete2Id: 'x', discipline: 'MD' }),
      pair({ id: 'p9', athlete1Id: 'a', athlete2Id: 'x', discipline: 'MD', active: false }),
      pair({ id: 'p8', athlete1Id: 'a', athlete2Id: 'x', discipline: 'MD', deleted: true }),
      pair({ id: 'p7', athlete1Id: 'g', athlete2Id: 'y', discipline: 'XD', deleted: true }),
      pair({ id: 'p6', athlete1Id: 'y', athlete2Id: 'a', discipline: 'XD' }),
      pair({ id: 'p5', athlete1Id: 'g', athlete2Id: 'a', discipline: 'MD', deleted: true }),
    ], 'g', 'a')
    expect(steps).toEqual([
      { pairId: 'p1', action: 'update', column: 'athlete1Id' },
      { pairId: 'p7', action: 'update', column: 'athlete1Id' },
    ])
  })

  it('dupla do avulso com o próprio atleta é conflito', () => {
    expect(planPairMerge([pair({ id: 'p1', athlete1Id: 'g', athlete2Id: 'a', discipline: 'MD' })], 'g', 'a').conflict).toBe(true)
  })
})

describe('sharedCategories', () => {
  it('lista as categorias em que os dois já estão, sem repetir', () => {
    expect(sharedCategories(['c1', 'c2', 'c1'], ['c2', 'c3'])).toEqual(['c2'])
    expect(sharedCategories(['c1'], [])).toEqual([])
  })
})
