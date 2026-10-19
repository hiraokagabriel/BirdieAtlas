import type { Paginated, Pagination } from "@birdie-atlas/types";
import type { PaginationQuery } from "@birdie-atlas/validators";

export function getPagination({ page, pageSize }: PaginationQuery, total: number): Pagination {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

/**
 * Monta a resposta padrão `{ data, pagination }`. `fetchPage` recebe limit/offset
 * já calculados; `countTotal` conta o conjunto inteiro com os mesmos filtros.
 */
export async function paginate<T>(
  query: PaginationQuery,
  fetchPage: (limit: number, offset: number) => Promise<T[]>,
  countTotal: () => Promise<number>,
): Promise<Paginated<T>> {
  const [data, total] = await Promise.all([
    fetchPage(query.pageSize, (query.page - 1) * query.pageSize),
    countTotal(),
  ]);
  return { data, pagination: getPagination(query, total) };
}
