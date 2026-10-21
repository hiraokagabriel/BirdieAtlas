import { describe, expect, it } from 'vitest'
import {
  buildAthleteCard,
  buildRankingCard,
  buildTournamentCard,
  singleChampion,
  type PlacedRegistration,
  type TournamentCardInput,
} from './share-cards'

const tournament: TournamentCardInput['tournament'] = {
  name: 'Copa Paulista de Badminton',
  status: 'completed',
  level: 'state',
  startDate: '2026-03-07',
  endDate: '2026-03-08',
  city: 'São Paulo',
  state: 'SP',
}
const stats = { totalCategories: 2, totalAthletes: 12, totalMatches: 20, completedMatches: 20 }

function reg(name: string, placement: number | null, partner: string | null = null): PlacedRegistration {
  return { athleteName: name, athlete2Name: partner, finalPlacement: placement }
}

describe('buildTournamentCard', () => {
  const categories = [
    { id: 'c1', name: 'Simples Masculino' },
    { id: 'c2', name: 'Duplas Femininas' },
  ]

  it('builds the podium per category with both bronze medalists and doubles pairs', () => {
    const card = buildTournamentCard({
      tournament,
      categories,
      stats,
      registrationsByCategory: new Map([
        ['c1', [reg('Ana', 1), reg('Bia', 2), reg('Cris', 3), reg('Dani', 3), reg('Eva', 5)]],
        ['c2', [reg('Fê', 1, 'Gi'), reg('Hel', 2, 'Isa')]],
      ]),
    })
    expect(card.completed).toBe(true)
    expect(card.levelLabel).toBe('Estadual')
    expect(card.dateRange).toBe('07/03/2026 – 08/03/2026')
    expect(card.place).toBe('São Paulo / SP')
    expect(card.podium).toEqual([
      { name: 'Simples Masculino', first: ['Ana'], second: ['Bia'], third: ['Cris', 'Dani'] },
      { name: 'Duplas Femininas', first: ['Fê / Gi'], second: ['Hel / Isa'], third: [] },
    ])
  })

  it('has no podium before the tournament ends, even if placements exist', () => {
    const card = buildTournamentCard({
      tournament: { ...tournament, status: 'in_progress' },
      categories,
      stats,
      registrationsByCategory: new Map([['c1', [reg('Ana', 1)]]]),
    })
    expect(card.completed).toBe(false)
    expect(card.podium).toEqual([])
    expect(card.statusLabel).toBe('Em andamento')
    expect(card.stats).toEqual({ categories: 2, athletes: 12, matches: 20 })
  })

  it('skips categories without a champion', () => {
    const card = buildTournamentCard({
      tournament,
      categories,
      stats,
      registrationsByCategory: new Map([['c1', [reg('Ana', null)]]]),
    })
    expect(card.podium).toEqual([])
  })

  it('limits long names and strips invisible characters so the layout never breaks', () => {
    const card = buildTournamentCard({
      tournament: { ...tournament, name: `Campeonato ${'Muito '.repeat(40)}Longo‮` },
      categories: [{ id: 'c1', name: 'Categoria '.repeat(20) }],
      stats,
      registrationsByCategory: new Map([['c1', [reg('Nome '.repeat(30), 1)]]]),
    })
    expect(Array.from(card.name).length).toBeLessThanOrEqual(64)
    expect(card.name.endsWith('…')).toBe(true)
    expect(card.name).not.toContain('‮')
    expect(Array.from(card.podium[0]?.name ?? '').length).toBeLessThanOrEqual(34)
    expect(Array.from(card.podium[0]?.first[0] ?? '').length).toBeLessThanOrEqual(30)
  })

  it('falls back to the raw level when it is unknown', () => {
    const card = buildTournamentCard({
      tournament: { ...tournament, level: 'galactic' },
      categories: [],
      stats,
      registrationsByCategory: new Map(),
    })
    expect(card.levelLabel).toBe('galactic')
  })
})

describe('singleChampion', () => {
  it('returns the champion only when there is exactly one podium category', () => {
    expect(singleChampion([{ name: 'MS', first: ['Ana'], second: [], third: [] }])).toBe('Ana')
    expect(
      singleChampion([
        { name: 'MS', first: ['Ana'], second: [], third: [] },
        { name: 'WS', first: ['Bia'], second: [], third: [] },
      ]),
    ).toBe('')
    expect(singleChampion([])).toBe('')
  })
})

describe('buildAthleteCard', () => {
  it('summarizes titles, podiums and the best ranking position', () => {
    const card = buildAthleteCard({
      athlete: { name: 'Ana Souza' },
      currentClub: { clubName: 'Clube Alfa', city: 'Campinas', state: 'SP' },
      rankingPositions: [
        { rankingName: 'Ranking 2026', discipline: 'WS', position: 4 },
        { rankingName: 'Ranking Duplas', discipline: 'WD', position: 2 },
        { rankingName: 'Sem posição', discipline: 'XD', position: null },
      ],
      tournamentHistory: [
        { tournamentId: 't1', finalPlacement: 1 },
        { tournamentId: 't2', finalPlacement: 3 },
        { tournamentId: 't3', finalPlacement: 9 },
        { tournamentId: 't4', finalPlacement: null },
      ],
    })
    expect(card).toMatchObject({
      name: 'Ana Souza',
      initials: 'AS',
      clubName: 'Clube Alfa',
      place: 'Campinas / SP',
      tournaments: 4,
      titles: 1,
      podiums: 2,
      bestPosition: 2,
      bestRankingName: 'Ranking Duplas · Duplas femininas',
    })
  })

  it('handles an athlete without club, history or ranking', () => {
    const card = buildAthleteCard({ athlete: { name: 'Novato' }, currentClub: null, rankingPositions: [], tournamentHistory: [] })
    expect(card).toMatchObject({ clubName: '', place: '', titles: 0, podiums: 0, bestPosition: null, bestRankingName: '' })
  })
})

describe('buildRankingCard', () => {
  const entries = Array.from({ length: 14 }, (_, i) => ({
    position: i + 1,
    totalPoints: 12000 - i * 100,
    athleteName: `Atleta ${i + 1}`,
    athlete2Name: i === 0 ? 'Parceira' : null,
  }))

  it('keeps the top 10 with pt-BR points and pairs joined', () => {
    const card = buildRankingCard({ name: 'Ranking Simples 2026', discipline: 'MS', year: 2026, tenantName: 'FPB-SP', entries })
    expect(card.rows).toHaveLength(10)
    expect(card.rows[0]).toEqual({ position: 1, name: 'Atleta 1 / Parceira', points: (12000).toLocaleString('pt-BR') })
    expect(card.disciplineLabel).toBe('Simples masculino')
    expect(card.year).toBe(2026)
  })

  it('returns no rows for an empty ranking', () => {
    expect(buildRankingCard({ name: 'R', discipline: 'MS', year: 2026, tenantName: 'F', entries: [] }).rows).toEqual([])
  })
})
