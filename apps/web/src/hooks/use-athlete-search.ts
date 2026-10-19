'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'

export interface AthleteOption {
  id: string
  name: string
  gender: 'M' | 'F'
  clubName: string | null
}

/** Máximo que a API devolve por página; pickers pedem para refinar a busca além disso. */
export const ATHLETE_SEARCH_LIMIT = 100

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** Busca de atletas no servidor para pickers (nome ou e-mail, filtro opcional de gênero). */
export function useAthleteSearch(search: string, gender?: 'M' | 'F') {
  const term = useDebounced(search.trim(), 250)

  const query = useQuery({
    queryKey: ['athletes', 'search', term, gender ?? 'any'],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: String(ATHLETE_SEARCH_LIMIT) })
      if (term) params.set('search', term)
      if (gender) params.set('gender', gender)
      return apiFetch<Paginated<AthleteOption>>(`/athletes?${params}`)
    },
    placeholderData: keepPreviousData,
  })

  return {
    athletes: query.data?.data ?? [],
    total: query.data?.pagination.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  }
}
