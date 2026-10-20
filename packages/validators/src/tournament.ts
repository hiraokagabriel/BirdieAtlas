import { z } from "zod";

export const TOURNAMENT_STATUSES = [
  "draft",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const tournamentStatusSchema = z.enum(TOURNAMENT_STATUSES);

export const TOURNAMENT_LEVELS = ["local", "regional", "state", "national", "international"] as const;
export const tournamentLevelSchema = z.enum(TOURNAMENT_LEVELS);
export type TournamentLevel = z.infer<typeof tournamentLevelSchema>;
export type TournamentStatus = z.infer<typeof tournamentStatusSchema>;

/** Rótulos em português do nível do torneio. Fonte única para telas administrativas e públicas. */
export const TOURNAMENT_LEVEL_LABELS: Record<TournamentLevel, string> = {
  local: "Municipal",
  regional: "Regional",
  state: "Estadual",
  national: "Nacional",
  international: "Internacional",
};

/** Rótulos em português do status do torneio. */
export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "Rascunho",
  registration_open: "Inscrições abertas",
  registration_closed: "Inscrições encerradas",
  in_progress: "Em andamento",
  completed: "Encerrado",
  cancelled: "Cancelado",
};

/**
 * Ciclo de vida do torneio. Fonte única para API e web.
 * - Avança em ordem: rascunho → inscrições abertas → inscrições encerradas → em andamento → encerrado.
 * - Pode ser cancelado em qualquer estado antes de encerrado.
 * - Encerrado volta para em andamento só via reabertura (reverte pontos).
 */
export const TOURNAMENT_TRANSITIONS: Record<TournamentStatus, readonly TournamentStatus[]> = {
  draft: ["registration_open", "cancelled"],
  registration_open: ["registration_closed", "cancelled"],
  registration_closed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: [],
};

export function canTransitionTournament(from: TournamentStatus, to: TournamentStatus): boolean {
  return TOURNAMENT_TRANSITIONS[from].includes(to);
}

/**
 * Transições que exigem fluxo próprio com efeitos colaterais:
 * encerrar calcula o pódio (POST /tournaments/:id/finalize) e
 * reabrir reverte pontos de ranking (POST /tournaments/:id/reopen).
 */
export function dedicatedTransitionEndpoint(from: TournamentStatus, to: TournamentStatus): "finalize" | "reopen" | null {
  if (to === "completed") return "finalize";
  if (from === "completed" && to === "in_progress") return "reopen";
  return null;
}

export const tournamentTransitionBodySchema = z.object({
  to: tournamentStatusSchema,
}).strict();

export type TournamentTransitionBody = z.infer<typeof tournamentTransitionBodySchema>;
