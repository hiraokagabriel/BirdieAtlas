import { describe, expect, it } from "vitest";
import { buildMatchDefs, buildSlots } from "./bracket.js";

const regs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, seed: null }));

describe("bracket generation", () => {
  it("numbers rounds down to the final and links each match to the next round", () => {
    const defs = buildMatchDefs("d1", buildSlots(regs(8), "random"));
    const byId = new Map(defs.map((m) => [m.id, m]));

    expect(defs.filter((m) => m.round === 3)).toHaveLength(4);
    expect(defs.filter((m) => m.round === 2)).toHaveLength(2);
    expect(defs.filter((m) => m.round === 1)).toHaveLength(1);

    for (const m of defs) {
      if (m.round === 1) {
        expect(m.nextMatchId).toBeNull();
        continue;
      }
      const next = byId.get(m.nextMatchId!)!;
      expect(next.round).toBe(m.round - 1);
      expect(next.position).toBe(Math.ceil(m.position / 2));
    }
  });

  it("fills the first phase and advances byes as walkovers", () => {
    const defs = buildMatchDefs("d1", buildSlots(regs(6), "random"));
    const first = defs.filter((m) => m.round === 3);
    const placed = first.flatMap((m) => [m.registration1Id, m.registration2Id]).filter(Boolean);

    expect(placed.sort()).toEqual(regs(6).map((r) => r.id).sort());
    const byes = first.filter((m) => m.status === "walkover");
    expect(byes).toHaveLength(2);
    for (const bye of byes) {
      const next = defs.find((m) => m.id === bye.nextMatchId)!;
      const winner = bye.registration1Id ?? bye.registration2Id;
      expect([next.registration1Id, next.registration2Id]).toContain(winner);
    }
  });
});
