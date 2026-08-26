import { z } from "zod";

export const registrationStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const registrationIdParamsSchema = z.object({
  registrationId: z.string().trim().min(1),
});

export const tournamentRegistrationsParamsSchema = z.object({
  tournamentId: z.string().trim().min(1),
});

export const tournamentRegistrationsQuerySchema = z.object({
  status: registrationStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateRegistrationBodySchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  status: registrationStatusSchema.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe pelo menos um campo para atualização.",
});

export const registrationResponseSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  athleteId: z.string().nullable(),
  pairId: z.string().nullable(),
  categoryId: z.string(),
  status: registrationStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const registrationListResponseSchema = z.object({
  data: z.array(registrationResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;
export type RegistrationIdParams = z.infer<typeof registrationIdParamsSchema>;
export type TournamentRegistrationsParams = z.infer<typeof tournamentRegistrationsParamsSchema>;
export type TournamentRegistrationsQuery = z.infer<typeof tournamentRegistrationsQuerySchema>;
export type UpdateRegistrationBody = z.infer<typeof updateRegistrationBodySchema>;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;
export type RegistrationListResponse = z.infer<typeof registrationListResponseSchema>;
