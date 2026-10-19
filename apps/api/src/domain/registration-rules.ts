import type { Pagination } from "@birdie-atlas/types";
import type { RegistrationStatus } from "@birdie-atlas/validators";

export type RegistrationTournamentStatus =
  | "draft"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed"
  | "cancelled";

interface RegistrationFlags {
  confirmed: boolean;
  withdrew: boolean;
}

const STATUS_TRANSITIONS: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  pending: ["pending", "approved", "rejected"],
  approved: ["approved", "pending", "rejected"],
  rejected: ["rejected", "pending"],
};

export function getRegistrationStatus({ confirmed, withdrew }: RegistrationFlags): RegistrationStatus {
  if (withdrew) return "rejected";
  if (confirmed) return "approved";
  return "pending";
}

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

export function canEditRegistration(tournamentStatus: RegistrationTournamentStatus): boolean {
  return !["completed", "cancelled"].includes(tournamentStatus);
}
