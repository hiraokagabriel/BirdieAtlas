import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING, isFinishedSet, scoringLabel, scoringRuleSchema, setWinner, validateSets, type ScoringRule } from "./scoring.js";

const R15: ScoringRule = { pointsPerSet: 15, setPointCap: 21, setsToWin: 2 };
const SUDDEN: ScoringRule = { pointsPerSet: 11, setPointCap: 11, setsToWin: 1 };

describe("setWinner", () => {
  it("21 com vantagem de 2 e teto 30", () => {
    expect(setWinner(21, 19)).toBe(1);
    expect(setWinner(21, 20)).toBeNull();
    expect(setWinner(29, 29)).toBeNull();
    expect(setWinner(29, 30)).toBe(2);
  });
  it("15 com teto 21", () => {
    expect(setWinner(15, 13, R15)).toBe(1);
    expect(setWinner(15, 14, R15)).toBeNull();
    expect(setWinner(20, 21, R15)).toBe(2);
  });
});

describe("isFinishedSet", () => {
  it.each([
    [21, 0, true], [21, 19, true], [22, 20, true], [30, 29, true], [30, 28, true],
    [21, 20, false], [23, 20, false], [31, 29, false], [20, 10, false], [30, 27, false], [21, 21, false],
  ])("21x3: %i-%i → %s", (a, b, ok) => expect(isFinishedSet(a, b, DEFAULT_SCORING)).toBe(ok));

  it.each([
    [15, 0, true], [15, 13, true], [16, 14, true], [21, 20, true], [21, 19, true],
    [15, 14, false], [21, 15, false], [22, 20, false],
  ])("15x3: %i-%i → %s", (a, b, ok) => expect(isFinishedSet(a, b, R15)).toBe(ok));

  it("sem vantagem: quem chega aos pontos vence", () => {
    expect(isFinishedSet(11, 10, SUDDEN)).toBe(true);
    expect(isFinishedSet(12, 10, SUDDEN)).toBe(false);
  });
});

describe("validateSets", () => {
  it("aceita 2-0 e 2-1", () => {
    expect(validateSets([{ score1: 15, score2: 10 }, { score1: 16, score2: 14 }], R15)).toBeNull();
    expect(validateSets([{ score1: 15, score2: 10 }, { score1: 10, score2: 15 }, { score1: 21, score2: 20 }], R15)).toBeNull();
  });
  it("recusa set que não fecha, set sobrando e partida sem vencedor", () => {
    expect(validateSets([{ score1: 21, score2: 15 }, { score1: 21, score2: 15 }], R15)).toBe(
      "O 1º set (21-15) não é um placar final: o set acaba em 15 com 2 de vantagem, ou em 21.",
    );
    expect(validateSets([{ score1: 15, score2: 1 }, { score1: 15, score2: 1 }, { score1: 15, score2: 1 }], R15)).toMatch(/3º set não é necessário/);
    expect(validateSets([{ score1: 15, score2: 1 }], R15)).toMatch(/Faltam sets/);
  });
  it("set único", () => {
    expect(validateSets([{ score1: 11, score2: 9 }], SUDDEN)).toBeNull();
  });
});

describe("scoringRuleSchema e rótulo", () => {
  it("teto menor que os pontos é inválido", () => {
    expect(scoringRuleSchema.safeParse({ pointsPerSet: 21, setPointCap: 15, setsToWin: 2 }).success).toBe(false);
  });
  it("rótulos", () => {
    expect(scoringLabel(DEFAULT_SCORING)).toBe("21 pontos, melhor de 3 (teto 30)");
    expect(scoringLabel(SUDDEN)).toBe("11 pontos, set único");
  });
});
