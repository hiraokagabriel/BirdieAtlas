'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { BracketDraw } from './bracket-draw'
import { ErrorNotice } from '@/components/public/notices'
import { BracketSkeleton } from './bracket-tree'
import type { BracketMatch, BracketEntry, SetScore } from '@/lib/bracket'
import { Eye, EyeOff, Loader2, Trophy, AlertTriangle, CheckCircle2, Shuffle, Star, RotateCcw, X, Lock } from 'lucide-react'
import { DISCIPLINE_PILL, DISCIPLINE_PILL_ACTIVE } from '@/lib/discipline'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Category    = { id: string; name: string; discipline: string }
type Match       = BracketMatch
type Registration = BracketEntry
type Draw        = { id: string; published: boolean }
type MatchResult = SetScore
type DrawMode    = 'random' | 'seeded'

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
  const [selectedCategoryId, setActiveCategoryId] = useState<string>('')
  // As categorias chegam depois da primeira renderização: sem escolha explícita, usa a primeira
  const activeCategoryId = selectedCategoryId || categories[0]?.id || ''
  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const queryClient    = useQueryClient()
  const [alreadyAwarded, setAlreadyAwarded] = useState(pointsAwarded)
  const [selectedMode,   setSelectedMode]   = useState<DrawMode>('seeded')
  const [generateError,  setGenerateError]  = useState<string | null>(null)
  const [showRedraw,     setShowRedraw]      = useState(false)
  const [redrawMode,     setRedrawMode]      = useState<DrawMode>('seeded')
  const [redrawError,    setRedrawError]     = useState<string | null>(null)

  const { data: draws, isLoading: loadingDraw, error: drawsError } = useQuery({
    queryKey: ['draws', activeCategoryId],
    queryFn:  () => apiFetch<Draw[]>(`/tournaments/categories/${activeCategoryId}/draws`),
    enabled:  !!activeCategoryId,
  })

  const draw = draws?.[0]

  const { data: matches, isLoading: loadingMatches, error: matchesError } = useQuery({
    queryKey: ['matches', draw?.id],
    queryFn:  () => apiFetch<Match[]>(`/draws/${draw!.id}/matches`),
    enabled:  !!draw?.id,
  })

  const { data: registrations, error: registrationsError } = useQuery({
    queryKey: ['registrations', activeCategoryId],
    queryFn:  () => apiFetch<Registration[]>(`/tournaments/categories/${activeCategoryId}/registrations`),
    enabled:  !!activeCategoryId,
  })

  const { data: allResults, error: resultsError } = useQuery({
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

  const [awardError, setAwardError] = useState<string | null>(null)
  const { mutate: awardPoints, isPending: isAwarding, data: awardResult } = useMutation({
    mutationFn: () =>
      apiFetch<{ awarded: { athleteId: string; placement: number; points: number }[] }>(
        `/tournaments/${tournamentId}/award-points`, { method: 'POST' },
      ),
    onMutate: () => setAwardError(null),
    onSuccess: () => setAlreadyAwarded(true),
    // A mensagem da API diz o que falta (ex.: nenhum ranking tem regra para o nível do torneio)
    onError: (err: Error) => setAwardError(err.message),
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
  const loadError = drawsError ?? matchesError ?? registrationsError ?? resultsError

  return (
    <div className="space-y-4">

      {/* Category selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const isActive = cat.id === activeCategoryId
          const color    = isActive ? DISCIPLINE_PILL_ACTIVE[cat.discipline] : DISCIPLINE_PILL[cat.discipline]
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveCategoryId(cat.id); setGenerateError(null); setShowRedraw(false) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${color ?? 'bg-muted text-muted-foreground border-border'}`}
            >
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* Publish banner + Ressortear button */}
      {draw && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
          draw.published ? 'bg-success/10 border-success/30 text-success' : 'bg-warning/10 border-warning/30 text-warning'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${draw.published ? 'bg-success' : 'bg-warning'}`} />
            <span className="text-sm font-medium">
              {draw.published ? 'Chaveamento publicado — visível na página pública' : 'Rascunho — não visível na página pública'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Ressortear — bloqueado quando publicado */}
            {draw.published ? (
              <span
                title="Despublique a chave antes de ressortear"
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-md text-success/50 cursor-not-allowed select-none"
              >
                <Lock className="w-3.5 h-3.5" />
                Ressortear
              </span>
            ) : (
              <button
                onClick={() => { setShowRedraw((v) => !v); setRedrawError(null) }}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-md transition-colors hover:bg-warning/10 text-warning"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Ressortear
              </button>
            )}
            {/* Publicar / Despublicar */}
            <button
              onClick={() => togglePublish()}
              disabled={isTogglingPublish}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-md transition-colors ${
                draw.published
                  ? 'hover:bg-success/10 text-success'
                  : 'hover:bg-warning/10 text-warning'
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

      {/* Redraw confirmation panel — only shown when not published */}
      {showRedraw && draw && !draw.published && (
        <div className="rounded-xl border-2 border-warning/30 bg-warning/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Ressortear chaveamento</p>
              <p className="text-xs text-warning mt-0.5">
                Todos os resultados desta categoria serão <strong>apagados</strong> e a chave será gerada novamente.
              </p>
            </div>
            <button onClick={() => setShowRedraw(false)} className="p-1 rounded hover:bg-warning/15 text-warning">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3">
            <DrawModeCard mode="seeded"  selected={redrawMode === 'seeded'}  onSelect={setRedrawMode} />
            <DrawModeCard mode="random" selected={redrawMode === 'random'} onSelect={setRedrawMode} />
          </div>

          {redrawError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/80 disabled:opacity-50 transition-colors"
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
          alreadyAwarded || awardResult ? 'bg-success/10 border-success/30' : 'bg-info/10 border-info/30'
        }`}>
          <div className="flex items-center gap-2">
            {alreadyAwarded || awardResult
              ? <CheckCircle2 className="w-4 h-4 text-success" />
              : <Trophy className="w-4 h-4 text-info" />}
            <div>
              <p className={`text-sm font-medium ${alreadyAwarded || awardResult ? 'text-success' : 'text-info'}`}>
                {alreadyAwarded
                  ? 'Pontos já distribuídos'
                  : awardResult
                    ? `Pontos distribuídos — ${awardResult.awarded.length} atletas premiados`
                    : 'Todas as partidas encerradas'}
              </p>
              {!alreadyAwarded && !awardResult && (
                <p className="text-xs text-info mt-0.5">
                  Pronto para distribuir os pontos nos rankings
                </p>
              )}
            </div>
          </div>
          {!alreadyAwarded && !awardResult && (
            <button
              onClick={() => awardPoints()}
              disabled={isAwarding}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAwarding
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Distribuindo...</>
                : <><Trophy className="w-3.5 h-3.5" /> Distribuir pontos</>}
            </button>
          )}
        </div>
      )}

      {awardError && (
        <div role="alert" className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-warning/30 bg-warning/10 text-warning text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {awardError}
        </div>
      )}

      {/* Bracket area */}
      <div className="min-w-0">
        {loadError ? (
          <ErrorNotice>Não foi possível carregar a chave: {loadError.message}</ErrorNotice>
        ) : isLoading ? (
          <div className="rounded-xl border border-border bg-card"><BracketSkeleton /></div>
        ) : !draw ? (
          <div className="rounded-xl border border-border bg-card">
          <div className="p-10 flex flex-col items-center gap-6 max-w-lg mx-auto">
            <div className="text-center">
              <p className="text-lg font-semibold">Chave ainda não sorteada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha o modo de sorteio para a categoria <span className="font-medium">{activeCategory?.name}</span>
              </p>
            </div>
            <div className="flex gap-4 w-full">
              <DrawModeCard mode="seeded"  selected={selectedMode === 'seeded'}  onSelect={setSelectedMode} />
              <DrawModeCard mode="random" selected={selectedMode === 'random'} onSelect={setSelectedMode} />
            </div>
            {generateError && (
              <div className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
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
          </div>
        ) : (
          <BracketDraw
            matches={matches ?? []}
            registrations={registrations ?? []}
            results={allResults ?? []}
            activeCategory={activeCategory}
            drawId={draw.id}
          />
        )}
      </div>
    </div>
  )
}
