import { describe, expect, it } from 'vitest'
import type { MatchDef } from './bracket.js'
import { buildDoubleEliminationDefs, computeDoubleEliminationPlacements, planDoubleElimination } from './double-elimination.js'

const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1 }))
const WIN1 = [{ score1: 21, score2: 10 }, { score1: 21, score2: 10 }]
const WIN2 = [{ score1: 10, score2: 21 }, { score1: 10, score2: 21 }]

type Sim = { defs: MatchDef[]; losses: Map<string, number>; sets: Map<string, { score1: number; score2: number }[]>; played: string[] }

/**
 * Joga a chave inteira seguindo os ponteiros (como saveMatchResult). `pick(match)` devolve o lado vencedor.
 * Partidas sem os dois participantes (byes) e o reset vazio ficam de fora.
 */
function simulate(defs: MatchDef[], pick: (m: MatchDef) => 1 | 2): Sim {
  const byId = new Map(defs.map((d) => [d.id, { ...d }]))
  const losses = new Map<string, number>()
  const sets = new Map<string, { score1: number; score2: number }[]>()
  const played: string[] = []
  const place = (id: string | null | undefined, slot: number | null | undefined, reg: string) => {
    if (!id) return
    const target = byId.get(id)!
    if (slot === 1) target.registration1Id = reg
    else target.registration2Id = reg
  }
  for (let guard = 0; guard < 500; guard++) {
    const ready = [...byId.values()].find(
      (m) => m.status === 'pending' && m.registration1Id && m.registration2Id && m.stage !== 'grand_final_reset' || (m.stage === 'grand_final_reset' && m.status === 'pending' && m.registration1Id && m.registration2Id),
    )
    if (!ready) break
    const side = pick(ready)
    const winner = side === 1 ? ready.registration1Id! : ready.registration2Id!
    const loser = side === 1 ? ready.registration2Id! : ready.registration1Id!
    ready.status = 'completed' as never
    sets.set(ready.id, side === 1 ? WIN1 : WIN2)
    played.push(ready.id)
    losses.set(loser, (losses.get(loser) ?? 0) + 1)
    place(ready.nextMatchId, ready.nextSlot, winner)
    place(ready.loserNextMatchId, ready.loserNextSlot, loser)
    if (ready.stage === 'grand_final') {
      const gf2 = [...byId.values()].find((m) => m.stage === 'grand_final_reset')
      if (gf2 && side === 2) { gf2.registration1Id = ready.registration1Id; gf2.registration2Id = ready.registration2Id }
    }
  }
  return { defs: [...byId.values()], losses, sets, played }
}

describe('planDoubleElimination', () => {
  it('limites', () => {
    expect(planDoubleElimination(8)).toEqual({ ok: true, bracketSize: 8, knockoutRounds: 3 })
    expect(planDoubleElimination(5)).toMatchObject({ ok: true, bracketSize: 8 })
    expect(planDoubleElimination(2)).toMatchObject({ ok: false })
    expect(planDoubleElimination(65)).toMatchObject({ ok: false })
  })
})

describe('buildDoubleEliminationDefs: estrutura', () => {
  for (const n of [3, 4, 5, 6, 7, 8, 9, 12, 16, 17, 32]) {
    it(`${n} inscritos, com reset: ${2 * n - 2} partidas jogáveis fora o reset, todo mundo no máximo 2 derrotas`, () => {
      const defs = buildDoubleEliminationDefs('d', entries(n), 'seeded', true)
      const playable = defs.filter((m) => m.stage !== 'grand_final_reset' && m.registration1Id !== null && m.registration2Id !== null).length
      // Partidas com os dois participantes definidos na geração (1ª rodada) + as que se formam depois: conta pela simulação.
      const sim = simulate(defs, () => 1)
      const real = sim.played.filter((id) => sim.defs.find((m) => m.id === id)!.stage !== 'grand_final_reset').length
      expect(real).toBe(2 * n - 2)
      expect(Math.max(...sim.losses.values())).toBeLessThanOrEqual(2)
      expect(playable).toBeGreaterThan(0)
    })
  }

  it('sem reset não existe a partida de reset', () => {
    const defs = buildDoubleEliminationDefs('d', entries(8), 'seeded', false)
    expect(defs.some((m) => m.stage === 'grand_final_reset')).toBe(false)
    expect(buildDoubleEliminationDefs('d', entries(8), 'seeded', true).some((m) => m.stage === 'grand_final_reset')).toBe(true)
  })

  it('rodadas respeitam a ordem de jogo: quem alimenta vem antes (número maior)', () => {
    const defs = buildDoubleEliminationDefs('d', entries(8), 'seeded', true)
    const byId = new Map(defs.map((d) => [d.id, d]))
    for (const m of defs) {
      for (const target of [m.nextMatchId, m.loserNextMatchId]) {
        if (target) expect(m.round).toBeGreaterThan(byId.get(target)!.round)
      }
    }
    const gf1 = defs.find((m) => m.stage === 'grand_final')!
    const gf2 = defs.find((m) => m.stage === 'grand_final_reset')!
    expect(gf1.round).toBeGreaterThan(gf2.round)
    expect(gf2.round).toBe(1)
  })

  it('byes: o perdedor de uma partida sem dois participantes não gera vaga, e o outro avança direto', () => {
    const defs = buildDoubleEliminationDefs('d', entries(5), 'seeded', true)
    const lb = defs.filter((m) => m.stage === 'losers')
    // 5 inscritos (bracket de 8): a chave dos perdedores tem partidas reais a menos que o modelo completo (6).
    expect(lb.length).toBeLessThan(6)
    expect(lb.length).toBeGreaterThan(0)
  })

  it('cada partida real tem um destino para o vencedor, exceto a grande final e o reset', () => {
    const defs = buildDoubleEliminationDefs('d', entries(10), 'random', true)
    for (const m of defs) {
      if (m.stage === 'grand_final' || m.stage === 'grand_final_reset') expect(m.nextMatchId).toBeNull()
      else expect(m.nextMatchId, `${m.stage} ${m.roundLabel}`).not.toBeNull()
      if (m.nextMatchId) expect([1, 2]).toContain(m.nextSlot)
    }
  })

  it('rótulos em português', () => {
    const labels = new Set(buildDoubleEliminationDefs('d', entries(8), 'seeded', true).map((m) => m.roundLabel))
    expect(labels).toContain('Final dos vencedores')
    expect(labels).toContain('Final dos perdedores')
    expect(labels).toContain('Grande final')
    expect(labels).toContain('Grande final (reset)')
  })
})

describe('simulação completa', () => {
  it('lado 1 sempre vence: o campeão dos vencedores ganha a grande final e o reset não é jogado', () => {
    const defs = buildDoubleEliminationDefs('d', entries(8), 'seeded', true)
    const sim = simulate(defs, () => 1)
    const reset = sim.defs.find((m) => m.stage === 'grand_final_reset')!
    expect(reset.registration1Id).toBeNull()
    expect(sim.played).toHaveLength(14) // 2*8-2
    const placements = computeDoubleEliminationPlacements(sim.defs, sim.sets)
    expect(placements.get('p1')).toBe(1)
    expect([...placements.values()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 5, 7, 7])
  })

  it('campeão da chave dos perdedores vence a grande final: o reset é jogado e decide', () => {
    const defs = buildDoubleEliminationDefs('d', entries(8), 'seeded', true)
    // Na grande final vence o lado 2 (perdedores); no reset, o lado 2 de novo.
    const sim = simulate(defs, (m) => (m.stage === 'grand_final' || m.stage === 'grand_final_reset' ? 2 : 1))
    expect(sim.played).toHaveLength(15) // 2n-2 (já inclui a 1ª grande final) + o reset
    const reset = sim.defs.find((m) => m.stage === 'grand_final_reset')!
    expect(reset.registration1Id).not.toBeNull()
    const placements = computeDoubleEliminationPlacements(sim.defs, sim.sets)
    const champion = [...placements.entries()].find(([, p]) => p === 1)![0]
    expect(champion).toBe(reset.registration2Id)
    expect(placements.get(reset.registration1Id!)).toBe(2)
    expect(placements.size).toBe(8)
  })

  it('sem reset, a grande final decide', () => {
    const defs = buildDoubleEliminationDefs('d', entries(8), 'seeded', false)
    const sim = simulate(defs, (m) => (m.stage === 'grand_final' ? 2 : 1))
    expect(sim.played).toHaveLength(14)
    const placements = computeDoubleEliminationPlacements(sim.defs, sim.sets)
    const gf = sim.defs.find((m) => m.stage === 'grand_final')!
    expect([...placements.entries()].find(([, p]) => p === 1)![0]).toBe(gf.registration2Id)
  })

  for (const n of [3, 5, 6, 7, 9, 13]) {
    it(`${n} inscritos, resultados aleatórios: todos recebem colocação distinta quando não há empate de rodada`, () => {
      for (let run = 0; run < 15; run++) {
        const defs = buildDoubleEliminationDefs('d', entries(n), 'random', true)
        const sim = simulate(defs, () => (Math.random() < 0.5 ? 1 : 2))
        const placements = computeDoubleEliminationPlacements(sim.defs, sim.sets)
        expect(placements.size).toBe(n)
        const values = [...placements.values()]
        expect(values.filter((p) => p === 1)).toHaveLength(1)
        expect(values.filter((p) => p === 2)).toHaveLength(1)
        // Cada um perdeu no máximo 2 vezes e apenas um (o campeão) pode ter ainda "vida".
        expect(Math.max(...sim.losses.values())).toBeLessThanOrEqual(2)
      }
    })
  }
})
