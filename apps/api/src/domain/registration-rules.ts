import type { Pagination } from "@birdie-atlas/types";
import type { RegistrationStatus, TournamentStatus } from "@birdie-atlas/validators";

const STATUS_TRANSITIONS: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  pending: ["pending", "approved", "rejected"],
  approved: ["approved", "pending", "rejected"],
  rejected: ["rejected", "pending"],
};

export function canTransitionRegistrationStatus(
  currentStatus: RegistrationStatus,
  nextStatus: RegistrationStatus,
): boolean {
  return STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function validateRegistrationStatusChange(
  currentStatus: RegistrationStatus,
  nextStatus: RegistrationStatus,
  notes: string | null | undefined,
): string | null {
  if (!canTransitionRegistrationStatus(currentStatus, nextStatus)) {
    return `Transição inválida: ${currentStatus} para ${nextStatus}.`;
  }

  if (nextStatus === "rejected" && !notes?.trim()) {
    return "Informe o motivo da rejeição.";
  }

  return null;
}

export function canEditRegistration(tournamentStatus: TournamentStatus): boolean {
  return !["completed", "cancelled"].includes(tournamentStatus);
}
