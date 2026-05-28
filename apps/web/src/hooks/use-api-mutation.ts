'use client'

import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

type HttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface UseApiMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: Error, variables: TVariables) => void
}

/**
 * Thin wrapper around TanStack Query's useMutation + apiFetch.
 *
 * Eliminates the repetitive useState<boolean> + try/finally loading pattern.
 *
 * @example
 * const recalculate = useApiMutation(
 *   (id: string) => `/rankings/${id}/recalculate`,
 *   'POST'
 * )
 *
 * <button onClick={() => recalculate.mutate(rankingId)} disabled={recalculate.isPending}>
 *   {recalculate.isPending ? 'Recalculando...' : 'Recalcular'}
 * </button>
 */
export function useApiMutation<TData = unknown, TVariables = void>(
  path: (variables: TVariables) => string,
  method: HttpMethod = 'POST',
  options?: UseApiMutationOptions<TData, TVariables>,
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) =>
      apiFetch<TData>(path(variables), { method }),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
