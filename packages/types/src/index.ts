// Tipos compartilhados entre API e web. Somente tipos: nada aqui existe em runtime.

/** Corpo de erro padrão da API. */
export interface ApiErrorBody {
  error: string
  code?: string
  details?: unknown
}

/** Metadados de paginação devolvidos por toda lista da API. */
export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Formato padrão de lista da API. */
export interface Paginated<T> {
  data: T[]
  pagination: Pagination
}