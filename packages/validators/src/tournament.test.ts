import { describe, expect, it } from "vitest";
import {
  TOURNAMENT_STATUSES,
  canTransitionTournament,
  dedicatedTransitionEndpoint,
  tournamentTransitionBodySchema,
} from "./tournament.js";

describe("tournament lifecycle", () => {
  it("advances in order", () => {
    expect(canTransitionTournament("draft", "registration_open")).toBe(true);
    expect(canTransitionTournament("registration_open", "registration_closed")).toBe(true);
    expect(canTransitionTournament("registration_closed", "in_progress")).toBe(true);
    expect(canTransitionTournament("in_progress", "completed")).toBe(true);
  });

  it("does not skip or go back, except reopening a completed tournament", () => {
    expect(canTransitionTournament("draft", "in_progress")).toBe(false);
    expect(canTransitionTournament("in_progress", "registration_open")).toBe(false);
    expect(canTransitionTournament("completed", "in_progress")).toBe(true);
    expect(canTransitionTournament("completed", "draft")).toBe(false);
  });

  it("cancels from any state before completed and nothing leaves cancelled", () => {
    for (const status of ["draft", "registration_open", "registration_closed", "in_progress"] as const) {
      expect(canTransitionTournament(status, "cancelled")).toBe(true);
    }
    expect(canTransitionTournament("completed", "cancelled")).toBe(false);
    for (const status of TOURNAMENT_STATUSES) {
      expect(canTransitionTournament("cancelled", status)).toBe(false);
    }
  });

  it("routes finalize and reopen to their own endpoints", () => {
    expect(dedicatedTransitionEndpoint("in_progress", "completed")).toBe("finalize");
    expect(dedicatedTransitionEndpoint("completed", "in_progress")).toBe("reopen");
    expect(dedicatedTransitionEndpoint("draft", "registration_open")).toBeNull();
  });

  it("validates the transition body", () => {
    expect(tournamentTransitionBodySchema.safeParse({ to: "registration_open" }).success).toBe(true);
    expect(tournamentTransitionBodySchema.safeParse({ to: "archived" }).success).toBe(false);
    expect(tournamentTransitionBodySchema.safeParse({ to: "draft", extra: 1 }).success).toBe(false);
  });
});
