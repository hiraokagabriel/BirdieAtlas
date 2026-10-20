import { describe, expect, it } from "vitest";
import { checkRegistrationEligibility, isDoublesDiscipline, isGenderCompatible, normalizePair } from "./eligibility.js";

const man = { id: "m1", gender: "M", active: true } as const;
const man2 = { id: "m2", gender: "M", active: true } as const;
const woman = { id: "w1", gender: "F", active: true } as const;

const base = { takenAthleteIds: new Set<string>(), maxEntries: null, currentEntries: 0 };

describe("gender rules", () => {
  it("applies each discipline's rule", () => {
    expect(isGenderCompatible("MS", "M")).toBe(true);
    expect(isGenderCompatible("MS", "F")).toBe(false);
    expect(isGenderCompatible("WD", "F", "F")).toBe(true);
    expect(isGenderCompatible("WD", "F", "M")).toBe(false);
    expect(isGenderCompatible("XD", "M", "F")).toBe(true);
    expect(isGenderCompatible("XD", "F", "M")).toBe(true);
    expect(isGenderCompatible("XD", "M", "M")).toBe(false);
    expect(isGenderCompatible("XD", "M")).toBe(false);
  });

  it("identifies doubles and normalizes pairs", () => {
    expect(["MD", "WD", "XD"].every(isDoublesDiscipline)).toBe(true);
    expect(["MS", "WS"].some(isDoublesDiscipline)).toBe(false);
    expect(normalizePair("b", "a")).toEqual(["a", "b"]);
    expect(normalizePair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("registration eligibility", () => {
  it("accepts a valid singles and a valid doubles registration", () => {
    expect(checkRegistrationEligibility({ ...base, discipline: "MS", athletes: [man] })).toBeNull();
    expect(checkRegistrationEligibility({ ...base, discipline: "XD", athletes: [man, woman] })).toBeNull();
  });

  it("requires the right number of athletes", () => {
    expect(checkRegistrationEligibility({ ...base, discipline: "MD", athletes: [man] })?.code).toBe("WRONG_PARTICIPANT_COUNT");
    expect(checkRegistrationEligibility({ ...base, discipline: "MS", athletes: [man, man2] })?.code).toBe("WRONG_PARTICIPANT_COUNT");
  });

  it("enforces gender and active status", () => {
    expect(checkRegistrationEligibility({ ...base, discipline: "WS", athletes: [man] })?.code).toBe("GENDER_INCOMPATIBLE");
    expect(checkRegistrationEligibility({ ...base, discipline: "MS", athletes: [{ ...man, active: false }] })?.code).toBe("ATHLETE_INACTIVE");
  });

  it("blocks an athlete already in the category, alone or through a pair", () => {
    const taken = new Set(["m2"]);
    expect(checkRegistrationEligibility({ ...base, takenAthleteIds: taken, discipline: "MD", athletes: [man, man2] })?.code).toBe("ATHLETE_ALREADY_REGISTERED");
  });

  it("blocks a full category", () => {
    expect(checkRegistrationEligibility({ ...base, maxEntries: 8, currentEntries: 8, discipline: "MS", athletes: [man] })?.code).toBe("CATEGORY_FULL");
    expect(checkRegistrationEligibility({ ...base, maxEntries: 8, currentEntries: 7, discipline: "MS", athletes: [man] })).toBeNull();
  });
});
