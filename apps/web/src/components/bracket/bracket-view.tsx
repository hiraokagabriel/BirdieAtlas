'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { BracketDraw } from './bracket-draw'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, EyeOff, Loader2, Trophy, AlertTriangle, CheckCircle2, Shuffle, Star, RotateCcw, X } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Category    = { id: string; name: string; discipline: string }
type Match       = { id: string; round: number; position: number; status: string; registration1Id: string | null; registration2Id: string | null; nextMatchId: string | null }
type Registration = { id: string; athleteId: string; athlete2Id: string | null; seed: number | null; rankingPointsAtEntry: number | null }
type Draw        = { id: string; published: boolean }
type MatchResult = { id: string; matchId: string; setNumber: number; score1: number; score2: number }
type Athlete     = { id: string; name: string }
type Tournament  = { id: string; pointsTableId: string | null }
type DrawMode    = 'random' | 'seeded'

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

// ─── Draw Mode Card ──────────────────────────────────────────────────────────

function DrawModeCard({ mode, selected, onSelect }: { mode: DrawMode; selected: boolean; onSelect: (m: DrawMode) => void }) {
  const isRandom = mode === 'random'
  return (
    <button
      onClick={() => onSelect(mode)}
      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/50'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {isRandom ? <Shuffle className="w-5 h-5" /> : <Star className="w-5 h-5" />}
      </div>
      <div>
        <p className="font-semibold text-sm text-center">{isRandom ? 'Sorteio Aleatório' : 'Com Cabeças de Chave'}</p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          {isRandom
            ? 'Todos os atletas embaralhados de forma totalmente aleatória'
            : 'Cabeças de chave fixadas; demais atletas sorteados aleatoriamente'}
        </p>
      </div>
    </button>
  )
}

// ─── BracketView ─────────────────────────────────────────────────────────────

export function BracketView({
  tournamentId,
  categories,
  pointsAwarded = false,
}: {
  tournamentId: string
  categories: Category[]
  pointsAwarded?: boolean
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? '')
  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const queryClient    = useQueryClient()
  const [alreadyAwarded, setAlreadyAwarded] = useState(pointsAwarded)
  const [selectedMode,   setSelectedMode]   = useState<DrawMode>('seeded')
  const [generateError,  setGenerateError]  = useState<string | null>(null)
  const [showRedraw,     setShowRedraw]      = useState(false)
  const [redrawMode,     setRedrawMode]      = useState<DrawMode>('seeded')
  const [redrawError,    setRedrawError]     = useState<string | null>(null)

  const { data: tournamentData } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn:  () => apiFetch<Tournament>(`/tournaments/${tournamentId}`),
    enabled:  !!tournamentId,
  })

  const { data: draws, isLoading: loadingDraw } = useQuery({
    queryKey: ['draws', activeCategoryId],
    queryFn:  () => apiFetch<Draw[]>(`/tournaments/categories/${activeCategoryId}/draws`),
    enabled:  !!activeCategoryId,
  })

  const draw = draws?.[0]

  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ['matches', draw?.id],
    queryFn:  () => apiFetch<Match[]>(`/draws/${draw!.id}/matches`),
    enabled:  !!draw?.id,
  })

  const { data: registrations } = useQuery({
    queryKey: ['registrations', activeCategoryId],
    queryFn:  () => apiFetch<Registration[]>(`/tournaments/categories/${activeCategoryId}/registrations`),
    enabled:  !!activeCategoryId,
  })

  const athleteIds = registrations
    ? [...new Set(registrations.flatMap((r) => [r.athleteId, r.athlete2Id].filter(Boolean) as string[]))]
    : []

  const { data: athletes } = useQuery({
    queryKey: ['athletes-batch', athleteIds.join(',')],
    queryFn:  () => apiFetch<Athlete[]>('/athletes'),
    enabled:  athleteIds.length > 0,
  })

  const { data: allResults } = useQuery({
    queryKey: ['results', draw?.id],
    queryFn:  async () => {
      if (!matches) return []
      const results = await Promise.all(matches.map((m) => apiFetch<MatchResult[]>(`/draws/matches/${m.id}/result`)))
      return results.flat()
    },
    enabled: !!matches?.length,
  })

  const { data: allDrawsData } = useQuery({
    queryKey: ['all-draws-status', tournamentId],
    queryFn:  async () => {
      const results: { categoryId: string; allDone: boolean }[] = []
      for (const cat of categories) {
        const drawList = await apiFetch<Draw[]>(`/tournaments/categories/${cat.id}/draws`)
        if (!drawList.length) { results.push({ categoryId: cat.id, allDone: false }); continue }
        const matchList = await apiFetch<Match[]>(`/draws/${drawList[0].id}/matches`)
        const done = matchList.length > 0 && matchList.every((m) => ['completed', 'walkover', 'retired'].includes(m.status))
        results.push({ categoryId: cat.id, allDone: done })
      }
      return results
    },
    enabled: categories.length > 0,
  })

  const allTournamentDone = allDrawsData?.every((d) => d.allDone) ?? false
  const hasRankingConfig  = !!tournamentData?.pointsTableId

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['draws', activeCategoryId] })
    queryClient.invalidateQueries({ queryKey: ['matches'] })
    queryClient.invalidateQueries({ queryKey: ['results'] })
    queryClient.invalidateQueries({ queryKey: ['all-draws-status', tournamentId] })
  }

  const { mutate: togglePublish, isPending: isTogglingPublish } = useMutation({
    mutationFn: async () => {
      const action = draw?.published ? 'unpublish' : 'publish'
      const res = await fetch(`${API_URL}/draws/${draw!.id}/${action}`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao alterar publicação')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['draws', activeCategoryId] }),
  })

  const { mutate: awardPoints, isPending: isAwarding, data: awardResult } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/tournaments/${tournamentId}/award-points`, { method: 'POST' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Erro ao distribuir pontos') }
      return res.json() as Promise<{ awarded: { athleteId: string; placement: number; points: number }[] }>
    },
    onSuccess: () => setAlreadyAwarded(true),
  })

  const { mutate: generateDraw, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      setGenerateError(null)
      const res = await fetch(`${API_URL}/draws/generate/${activeCategoryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Erro ao gerar chaveamento') }
      return res.json()
    },
    onSuccess:  invalidateAll,
    onError: (err: Error) => setGenerateError(err.message),
  })

  const { mutate: redraw, isPending: isRedrawing } = useMutation({
    mutationFn: async () => {
      setRedrawError(null)
      const res = await fetch(`${API_URL}/draws/${draw!.id}/redraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: redrawMode }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Erro ao ressortear') }
      return res.json()
    },
    onSuccess: () => { setShowRedraw(false); invalidateAll() },
    onError: (err: Error) => setRedrawError(err.message),
  })

  const isLoading = loadingDraw || loadingMatches

  return (
    <div className="space-y-4">

      {/* Category selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const isActive = cat.id === activeCategoryId
          const color    = isActive ? disciplineActiveColors[cat.discipline] : disciplineColors[cat.discipline]
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveCategoryId(cat.id); setGenerateError(null); setShowRedraw(false) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${color ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
            >
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* Publish banner + Ressortear button */}
      {draw && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
          draw.published ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${draw.published ? 'bg-green-500' : 'bg-yellow-400'}`} />
            <span className="text-sm font-medium">
              {draw.published ? 'Chaveamento publicado — visível na página pública' : 'Rascunho — não visível na página pública'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Ressortear */}
            <button
              onClick={() => { setShowRedraw((v) => !v); setRedrawError(null) }}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-md transition-colors ${
                draw.published
                  ? 'hover:bg-green-100 text-green-700'
                  : 'hover:bg-yellow-100 text-yellow-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Ressortear
            </button>
            {/* Publicar / Despublicar */}
            <button
              onClick={() => togglePublish()}
              disabled={isTogglingPublish}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-md transition-colors ${
                draw.published
                  ? 'hover:bg-green-100 text-green-700'
                  : 'hover:bg-yellow-100 text-yellow-700'
              }`}
            >
              {isTogglingPublish
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : draw.published
                  ? <><EyeOff className="w-3.5 h-3.5" /> Despublicar</>
                  : <><Eye className="w-3.5 h-3.5" /> Publicar</>}
            </button>
          </div>
        </div>
      )}

      {/* Redraw confirmation panel */}
      {showRedraw && draw && (
        <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-orange-900">Ressortear chaveamento</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Todos os resultados desta categoria serão <strong>apagados</strong> e a chave será gerada novamente.
              </p>
            </div>
            <button onClick={() => setShowRedraw(false)} className="p-1 rounded hover:bg-orange-100 text-orange-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3">
            <DrawModeCard mode="seeded"  selected={redrawMode === 'seeded'}  onSelect={setRedrawMode} />
            <DrawModeCard mode="random" selected={redrawMode === 'random'} onSelect={setRedrawMode} />
          </div>

          {redrawError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {redrawError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setShowRedraw(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => redraw()}
              disabled={isRedrawing}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {isRedrawing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Ressorteando...</>
                : <><RotateCcw className="w-4 h-4" /> Confirmar ressorteio</>}
            </button>
          </div>
        </div>
      )}

      {/* Award points banner */}
      {allTournamentDone && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
          alreadyAwarded || awardResult ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {alreadyAwarded || awardResult
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <Trophy className="w-4 h-4 text-blue-600" />}
            <div>
              <p className={`text-sm font-medium ${alreadyAwarded || awardResult ? 'text-green-800' : 'text-blue-800'}`}>
                {alreadyAwarded
                  ? 'Pontos já distribuídos'
                  : awardResult
                    ? `Pontos distribuídos — ${awardResult.awarded.length} atletas premiados`
                    : 'Todas as partidas encerradas'}
              </p>
              {!alreadyAwarded && !awardResult && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {hasRankingConfig
                    ? 'Pronto para distribuir pontos de ranking'
                    : 'Configure uma Tabela de pontos no torneio para habilitar'}
                </p>
              )}
            </div>
          </div>
          {!alreadyAwarded && !awardResult && (
            <button
              onClick={() => awardPoints()}
              disabled={isAwarding || !hasRankingConfig}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAwarding
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Distribuindo...</>
                : <><Trophy className="w-3.5 h-3.5" /> Distribuir pontos</>}
            </button>
          )}
        </div>
      )}

      {allTournamentDone && !hasRankingConfig && !alreadyAwarded && !awardResult && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Para distribuir pontos, vincule uma <strong>Tabela de pontos</strong> ao torneio nas configurações.
        </div>
      )}

      {/* Bracket area */}
      <div className="rounded-xl border border-border bg-card overflow-auto">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !draw ? (
          // ── Empty state: generate draw ──────────────────────────────────────
          <div className="p-10 flex flex-col items-center gap-6 max-w-lg mx-auto">
            <div className="text-center">
              <p className="text-lg font-semibold">Gerar Chaveamento</p>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha o modo de sorteio para a categoria <span className="font-medium">{activeCategory?.name}</span>
              </p>
            </div>
            <div className="flex gap-4 w-full">
              <DrawModeCard mode="seeded"  selected={selectedMode === 'seeded'}  onSelect={setSelectedMode} />
              <DrawModeCard mode="random" selected={selectedMode === 'random'} onSelect={setSelectedMode} />
            </div>
            {generateError && (
              <div className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {generateError}
              </div>
            )}
            <button
              onClick={() => generateDraw()}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isGenerating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                : <><Shuffle className="w-4 h-4" /> Sortear chave</>}
            </button>
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
