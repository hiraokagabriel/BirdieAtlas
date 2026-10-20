import { describe, expect, it } from "vitest";
import { findRule, parseEntries, resolvePoints, type PointRuleRow } from "./points.js";

const entries = [
  { placement: 1, basePoints: 1000 },
  { placement: 2, basePoints: 800 },
];

function rule(overrides: Partial<PointRuleRow>): PointRuleRow {
  return { id: "r", tournamentLevel: "state", discipline: null, multiplier: 1, participationBonus: 0, entries, ...overrides };
}

describe("point rule entries", () => {
  it("accepts arrays and JSON strings, and drops malformed items", () => {
    expect(parseEntries(entries)).toEqual(entries);
    expect(parseEntries(JSON.stringify(entries))).toEqual(entries);
    expect(parseEntries([{ placement: 1, basePoints: 10 }, { placement: "2" }, null, 7])).toEqual([{ placement: 1, basePoints: 10 }]);
    expect(parseEntries("not json")).toEqual([]);
    expect(parseEntries({})).toEqual([]);
  });
});

describe("rule lookup", () => {
  it("prefers the discipline rule over the generic one, per level", () => {
    const generic = rule({ id: "generic" });
    const specific = rule({ id: "specific", discipline: "MS" });
    expect(findRule([generic, specific], "state", "MS")?.id).toBe("specific");
    expect(findRule([generic, specific], "state", "WS")?.id).toBe("generic");
  });

  it("has no rule for a level that is not configured, or another discipline only", () => {
    expect(findRule([rule({})], "national", "MS")).toBeUndefined();
    expect(findRule([rule({ discipline: "MS" })], "state", "WS")).toBeUndefined();
  });
});

describe("points for a placement", () => {
  it("applies (base + participation bonus) * multiplier, rounded", () => {
    expect(resolvePoints([rule({ multiplier: 1.5, participationBonus: 10 })], "state", "MS", 1)).toBe(1515);
    expect(resolvePoints([rule({ multiplier: 0.75 })], "state", "MS", 2)).toBe(600);
    expect(resolvePoints([rule({ multiplier: 0.5, participationBonus: 5 })], "state", "MS", 1)).toBe(503);
  });

  it("gives only the participation share to a placement the rule does not list", () => {
    expect(resolvePoints([rule({ participationBonus: 10 })], "state", "MS", 9)).toBe(10);
    expect(resolvePoints([rule({})], "state", "MS", 9)).toBe(0);
  });

  it("is 0 when no rule covers the level", () => {
    expect(resolvePoints([rule({})], "national", "MS", 1)).toBe(0);
    expect(resolvePoints([], "state", "MS", 1)).toBe(0);
  });
});
