'use client'

import { useMemo, useState } from 'react'
import { Loader2, Swords } from 'lucide-react'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { ApiError, apiFetch } from '@/lib/api'
import { describeSlot, indexEntries, isFinishedStatus, slotLabel, type BracketEntry, type BracketMatch, type SetScore } from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'
import { BracketTree } from './bracket-tree'
import { MatchRounds } from './match-rounds'
import { StandingsTable } from './standings-table'
import { useStandings } from './use-standings'

export type GroupKnockoutDrawProps = {
  drawId: string
  matches: readonly BracketMatch[]
  entries: readonly BracketEntry[]
  results: readonly SetScore[]
  categoryName?: string | undefined
  /** Quantos de cada grupo avançam (destaca as primeiras posições). */
  advancePerGroup?: number | undefined
  onSelectMatch?: ((match: BracketMatch) => void) | undefined
  linkAthletes?: boolean | undefined
  live?: ReadonlyMap<string, LiveMatch> | undefined
  /** Admin: mostra o botão "Gerar eliminatória" e avisa quando ela foi criada. */
  onKnockoutGenerated?: (() => void) | undefined
}

/** Grupos + eliminatória: um bloco por grupo (classificação e rodadas) e, depois, a chave eliminatória. */
export function GroupKnockoutDraw({
  drawId, matches, entries, results, categoryName, advancePerGroup, onSelectMatch, linkAthletes, live, onKnockoutGenerated,
}: GroupKnockoutDrawProps) {
  const { data, error } = useStandings(drawId, matches, results)
  const entryIndex = useMemo(() => indexEntries(entries), [entries])
  const nameOf = (regId: string) => slotLabel(describeSlot(regId, entryIndex, false))
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  if (matches.length === 0) return <EmptyNotice>Nenhuma partida nesta chave.</EmptyNotice>

  const groupMatches = matches.filter((m) => m.stage === 'group')
  const knockoutMatches = matches.filter((m) => m.stage === 'knockout')
  const groupKeys = [...new Set(groupMatches.map((m) => m.groupKey ?? ''))].filter(Boolean).sort()
  const groupsDone = groupMatches.length > 0 && groupMatches.every((m) => isFinishedStatus(m.status))
  const canGenerate = !!onKnockoutGenerated && knockoutMatches.length === 0

  async function generateKnockout() {
    setGenerating(true)
    setGenerateError(null)
    try {
      await apiFetch(`/draws/${drawId}/knockout`, { method: 'POST' })
      onKnockoutGenerated?.()
    } catch (err) {
      setGenerateError(err instanceof ApiError || err instanceof Error ? err.message : 'Erro ao gerar a eliminatória.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-10 p-4">
      {groupKeys.map((key) => {
        const standings = data?.groups.find((g) => g.key === key)
        return (
          <section key={key} className="space-y-4">
            <h3 className="text-lg font-semibold">Grupo {key}</h3>
            {error && !data ? (
              <ErrorNotice>Não foi possível carregar a classificação: {error}</ErrorNotice>
            ) : !standings ? (
              <p role="status" className="text-sm text-muted-foreground">Carregando classificação...</p>
            ) : (
              <StandingsTable
                rows={standings.rows}
                nameOf={nameOf}
                label={`Classificação do Grupo ${key}${categoryName ? ` de ${categoryName}` : ''}`}
                highlightTop={advancePerGroup ?? 0}
              />
            )}
            <MatchRounds
              matches={groupMatches.filter((m) => m.groupKey === key)}
              entries={entries}
              results={results}
              onSelectMatch={onSelectMatch}
              linkAthletes={linkAthletes}
              live={live}
              stripPrefix={`Grupo ${key} · `}
            />
          </section>
        )
      })}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Eliminatória</h3>
        {knockoutMatches.length > 0 ? (
          <BracketTree
            matches={knockoutMatches}
            entries={entries}
            results={results}
            categoryName={categoryName}
            onSelectMatch={onSelectMatch}
            linkAthletes={linkAthletes}
            live={live}
          />
        ) : canGenerate ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border p-6">
            <p className="text-sm text-muted-foreground">
              {groupsDone
                ? 'Todos os grupos terminaram. Gere a eliminatória com os classificados.'
                : 'A eliminatória é gerada quando todas as partidas dos grupos tiverem resultado.'}
            </p>
            {generateError && (
              <p role="alert" className="text-sm text-destructive">{generateError}</p>
            )}
            <button
              type="button"
              onClick={generateKnockout}
              disabled={!groupsDone || generating}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {generating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Swords className="size-4" aria-hidden="true" />}
              {generating ? 'Gerando...' : 'Gerar eliminatória'}
            </button>
          </div>
        ) : (
          <EmptyNotice>A eliminatória será definida quando os grupos terminarem.</EmptyNotice>
        )}
      </section>
    </div>
  )
}
