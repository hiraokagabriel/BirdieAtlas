import { describe, expect, it } from "vitest";
import {
  canEditRegistration,
  canTransitionRegistrationStatus,
  getRegistrationStatus,
  validateRegistrationStatusChange,
} from "./registration-rules.js";

describe("registration domain rules", () => {
  it("maps persisted flags to domain status", () => {
    expect(getRegistrationStatus({ confirmed: false, withdrew: false })).toBe("pending");
    expect(getRegistrationStatus({ confirmed: true, withdrew: false })).toBe("approved");
    expect(getRegistrationStatus({ confirmed: true, withdrew: true })).toBe("rejected");
  });

  it("allows supported status transitions", () => {
    expect(canTransitionRegistrationStatus("pending", "approved")).toBe(true);
    expect(canTransitionRegistrationStatus("approved", "pending")).toBe(true);
    expect(canTransitionRegistrationStatus("rejected", "pending")).toBe(true);
    expect(canTransitionRegistrationStatus("rejected", "approved")).toBe(false);
  });

  it("requires a reason for rejection", () => {
    expect(validateRegistrationStatusChange("pending", "rejected", null)).toBe("Informe o motivo da rejeição.");
    expect(validateRegistrationStatusChange("pending", "rejected", "Documento inválido")).toBeNull();
  });

  it("blocks edits after tournament completion or cancellation", () => {
    expect(canEditRegistration("registration_open")).toBe(true);
    expect(canEditRegistration("in_progress")).toBe(true);
    expect(canEditRegistration("completed")).toBe(false);
    expect(canEditRegistration("cancelled")).toBe(false);
  });
});
