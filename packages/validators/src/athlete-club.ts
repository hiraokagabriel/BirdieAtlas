import { z } from "zod";

/** Troca o clube atual de um atleta: um clube existente (`clubId`), um clube novo pelo nome (`clubName`) ou nenhum (`clubId: null`). */
export const changeAthleteClubBodySchema = z.object({
  clubId: z.string().trim().min(1).nullable().optional(),
  clubName: z.string().trim().min(1).max(120).optional(),
}).strict().refine((v) => v.clubId !== undefined || v.clubName !== undefined, {
  message: "Informe o clube (clubId), o nome de um clube novo (clubName) ou clubId null para ficar sem clube.",
}).refine((v) => !(v.clubId && v.clubName), {
  message: "Informe clubId ou clubName, não os dois.",
});

export type ChangeAthleteClubBody = z.infer<typeof changeAthleteClubBodySchema>;
