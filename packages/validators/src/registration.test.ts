import { describe, expect, it } from "vitest";
import {
  registrationAuditEventSchema,
  tournamentRegistrationsQuerySchema,
  updateRegistrationBodySchema,
} from "./registration";

describe("registration validators", () => {
  it("applies safe pagination defaults", () => {
    expect(tournamentRegistrationsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
  });

  it("coerces valid pagination values", () => {
    expect(tournamentRegistrationsQuerySchema.parse({ page: "2", pageSize: "50", status: "pending" })).toEqual({ page: 2, pageSize: 50, status: "pending" });
  });

  it("rejects invalid status and unknown query fields", () => {
    expect(tournamentRegistrationsQuerySchema.safeParse({ status: "waiting" }).success).toBe(false);
    expect(tournamentRegistrationsQuerySchema.safeParse({ unexpected: true }).success).toBe(false);
  });

  it("rejects an empty update payload and unknown fields", () => {
    expect(updateRegistrationBodySchema.safeParse({}).success).toBe(false);
    expect(updateRegistrationBodySchema.safeParse({ status: "pending", unexpected: true }).success).toBe(false);
  });

  it("requires a non-empty reason when rejecting", () => {
    expect(updateRegistrationBodySchema.safeParse({ status: "rejected" }).success).toBe(false);
    expect(updateRegistrationBodySchema.safeParse({ status: "rejected", notes: "   " }).success).toBe(false);
    expect(updateRegistrationBodySchema.safeParse({ status: "rejected", notes: "Documento inválido" }).success).toBe(true);
  });

  it("accepts a valid update payload", () => {
    expect(updateRegistrationBodySchema.parse({ status: "approved", notes: "Documentação conferida" })).toEqual({ status: "approved", notes: "Documentação conferida" });
  });

  it("requires a valid audit event timestamp", () => {
    const valid = registrationAuditEventSchema.safeParse({ action: "approved", registrationId: "registration-1", actorId: "user-1", previousStatus: "pending", nextStatus: "approved", reason: null, occurredAt: "2026-08-26T17:00:00.000Z" });
    expect(valid.success).toBe(true);
    expect(registrationAuditEventSchema.safeParse({ ...valid.data, occurredAt: "invalid" }).success).toBe(false);
  });
});
