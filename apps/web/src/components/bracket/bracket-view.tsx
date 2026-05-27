'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { BracketDraw } from './bracket-draw'
import { Skeleton } from '@/components/ui/skeleton'

type Category = {
  id: string
  name: string
  discipline: string
}

type Match = {
  id: string
  round: number
  position: number
  status: string
  registration1Id: string | null
  registration2Id: string | null
}

type Registration = {
  id: string
  athleteId: string
  athlete2Id: string | null
  seed: number | null
  rankingPointsAtEntry: number | null
}

type Draw = {
  id: string
  published: boolean
}

type MatchResult = {
  id: string
  matchId: string
  setNumber: number
  score1: number
  score2: number
}

type Athlete = {
  id: string
  name: string
}

const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-700 border-blue-200',
  WS: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MD: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-500/10 text-pink-700 border-pink-200',
  XD: 'bg-orange-500/10 text-orange-700 border-orange-200',
}

const disciplineActiveColors: Record<string, string> = {
  MS: 'bg-blue-500 text-white border-blue-500',
  WS: 'bg-purple-500 text-white border-purple-500',
  MD: 'bg-cyan-500 text-white border-cyan-500',
  WD: 'bg-pink-500 text-white border-pink-500',
  XD: 'bg-orange-500 text-white border-orange-500',
}

export function BracketView({ tournamentId, categories }: { tournamentId: string; categories: Category[] }) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? '')
  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  const { data: draws, isLoading: loadingDraw } = useQuery({
    queryKey: ['draws', activeCategoryId],
    queryFn: () => apiFetch<Draw[]>(`/tournaments/categories/${activeCategoryId}/draws`),
    enabled: !!activeCategoryId,
  })

  const draw = draws?.[0]

  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ['matches', draw?.id],
    queryFn: () => apiFetch<Match[]>(`/draws/${draw!.id}/matches`),
    enabled: !!draw?.id,
  })

  const { data: registrations } = useQuery({
    queryKey: ['registrations', activeCategoryId],
    queryFn: () => apiFetch<Registration[]>(`/tournaments/categories/${activeCategoryId}/registrations`),
    enabled: !!activeCategoryId,
  })

  const athleteIds = registrations
    ? [...new Set(registrations.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
    : []

  const { data: athletes } = useQuery({
    queryKey: ['athletes-batch', athleteIds.join(',')],
    queryFn: () => apiFetch<Athlete[]>('/athletes'),
    enabled: athleteIds.length > 0,
  })

  const { data: allResults } = useQuery({
    queryKey: ['results', draw?.id],
    queryFn: async () => {
      if (!matches) return []
      const results = await Promise.all(
        matches.map((m) => apiFetch<MatchResult[]>(`/draws/matches/${m.id}/result`))
      )
      return results.flat()
    },
    enabled: !!matches?.length,
  })

  const isLoading = loadingDraw || loadingMatches

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const isActive = cat.id === activeCategoryId
          const color = isActive ? disciplineActiveColors[cat.discipline] : disciplineColors[cat.discipline]
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${color ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
            >
              {cat.name}
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-auto">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !draw ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">Chaveamento não gerado</p>
            <p className="text-sm mt-1">O chaveamento para esta categoria ainda não foi gerado.</p>
          </div>
        ) : (
          <BracketDraw
            matches={matches ?? []}
            registrations={registrations ?? []}
            athletes={athletes ?? []}
            results={allResults ?? []}
            activeCategory={activeCategory}
            drawId={draw.id}
          />
        )}
      </div>
    </div>
  )
}
