import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const registrationStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const registrationIdParamsSchema = z.object({
  registrationId: z.string().trim().min(1),
});

export const tournamentRegistrationsParamsSchema = z.object({
  tournamentId: z.string().trim().min(1),
});

export const tournamentRegistrationsQuerySchema = paginationQuerySchema.extend({
  status: registrationStatusSchema.optional(),
  categoryId: z.string().trim().min(1).optional(),
}).strict();

export const updateRegistrationBodySchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  status: registrationStatusSchema.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Informe pelo menos um campo para atualização.",
}).superRefine((value, context) => {
  if (value.status === "rejected" && !value.notes?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["notes"],
      message: "Informe o motivo da rejeição.",
    });
  }
});

export const approveRegistrationBodySchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict();

/**
 * Corpo da inscrição. Singles: só `athleteId`. Duplas: `pairId` de uma dupla existente
 * ou `athleteId` + `athlete2Id` (a dupla é criada ou reaproveitada). Qual forma vale
 * depende da disciplina da categoria, validada na API.
 */
export const registerBodySchema = z.object({
  athleteId: z.string().trim().min(1).optional(),
  athlete2Id: z.string().trim().min(1).optional(),
  pairId: z.string().trim().min(1).optional(),
  seed: z.number().int().min(1).optional(),
}).strict().superRefine((value, context) => {
  const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
  if (value.pairId !== undefined && (value.athleteId !== undefined || value.athlete2Id !== undefined)) {
    issue("Informe a dupla (pairId) ou os atletas, não os dois.");
  } else if (value.pairId === undefined && value.athleteId === undefined) {
    issue("Informe o atleta ou a dupla.");
  } else if (value.athlete2Id !== undefined && value.athleteId === undefined) {
    issue("athlete2Id exige athleteId.");
  } else if (value.athlete2Id !== undefined && value.athlete2Id === value.athleteId) {
    issue("Os dois atletas devem ser diferentes.");
  }
});
/** `athleteId`/`athlete2Id` são os atletas da inscrição; em duplas, os da dupla (`pairId`). */
export const registrationResponseSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  categoryId: z.string(),
  pairId: z.string().nullable(),
  athleteId: z.string(),
  athlete2Id: z.string().nullable(),
  athleteName: z.string().nullable(),
  athlete2Name: z.string().nullable(),
  seed: z.number().int().nullable(),
  status: registrationStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const registrationListResponseSchema = z.object({
  data: z.array(registrationResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }).strict(),
}).strict();

export const registrationAuditEventSchema = z.object({
  action: z.enum(["created", "updated", "approved", "rejected"]),
  registrationId: z.string().trim().min(1),
  actorId: z.string().trim().min(1),
  previousStatus: registrationStatusSchema.nullable(),
  nextStatus: registrationStatusSchema,
  reason: z.string().trim().max(1000).nullable(),
  occurredAt: z.string().datetime({ offset: true }),
}).strict();

export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;
export type RegistrationIdParams = z.infer<typeof registrationIdParamsSchema>;
export type TournamentRegistrationsParams = z.infer<typeof tournamentRegistrationsParamsSchema>;
export type TournamentRegistrationsQuery = z.infer<typeof tournamentRegistrationsQuerySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type UpdateRegistrationBody = z.infer<typeof updateRegistrationBodySchema>;
export type ApproveRegistrationBody = z.infer<typeof approveRegistrationBodySchema>;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;
export type RegistrationListResponse = z.infer<typeof registrationListResponseSchema>;
export type RegistrationAuditEvent = z.infer<typeof registrationAuditEventSchema>;
