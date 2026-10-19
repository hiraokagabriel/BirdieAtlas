import { z } from "zod";

/** Query de paginação padrão de toda lista da API: `page` a partir de 1, `pageSize` de 1 a 100 (padrão 25). */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
