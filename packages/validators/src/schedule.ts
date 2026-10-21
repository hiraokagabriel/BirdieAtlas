import { z } from "zod";

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutos desde 00:00 para "HH:mm"; `null` quando o texto é inválido. */
export function parseTimeOfDay(value: string): number | null {
  if (!TIME_OF_DAY.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return (h as number) * 60 + (m as number);
}

/**
 * Corpo de `POST /tournaments/:id/schedule/auto`.
 *
 * `startAt` é um instante ISO 8601 com deslocamento (`Z` ou `-03:00`). O deslocamento de `startAt`
 * também define o fuso em que `dayStartsAt` e `dayEndsAt` ("HH:mm") são lidos. O web envia o
 * deslocamento local do navegador.
 */
export const autoScheduleBodySchema = z
  .object({
    courts: z.number().int().min(1).max(32),
    startAt: z.string().datetime({ offset: true }),
    matchMinutes: z.number().int().min(5).max(240),
    restMinutes: z.number().int().min(0).max(240),
    reschedule: z.boolean().default(false),
    dayStartsAt: z.string().regex(TIME_OF_DAY, "Use o formato HH:mm.").optional(),
    dayEndsAt: z.string().regex(TIME_OF_DAY, "Use o formato HH:mm.").optional(),
    dryRun: z.boolean().default(true),
  })
  .superRefine((body, ctx) => {
    if (body.dayStartsAt && body.dayEndsAt) {
      const start = parseTimeOfDay(body.dayStartsAt) as number;
      const end = parseTimeOfDay(body.dayEndsAt) as number;
      if (end <= start) {
        ctx.addIssue({ code: "custom", path: ["dayEndsAt"], message: "O fim do dia deve ser depois do início." });
      } else if (end - start < body.matchMinutes) {
        ctx.addIssue({ code: "custom", path: ["dayEndsAt"], message: "A janela diária é menor que a duração da partida." });
      }
    }
  });

export type AutoScheduleBody = z.infer<typeof autoScheduleBodySchema>;
export type AutoScheduleInput = z.input<typeof autoScheduleBodySchema>;

/** Deslocamento UTC, em minutos, de um ISO com `Z` ou `±HH:mm` (ex.: "-03:00" → -180). */
export function utcOffsetMinutesFromIso(iso: string): number {
  const match = /([+-])(\d{2}):(\d{2})$/.exec(iso);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}
