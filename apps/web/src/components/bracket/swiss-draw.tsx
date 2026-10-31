'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { ErrorNotice, EmptyNotice } from '@/components/public/notices'
import { ApiError, apiFetch } from '@/lib/api'
import { describeSlot, indexEntries, isFinishedStatus, slotLabel, type BracketEntry, type BracketMatch, type SetScore } from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'
import { MatchRounds } from './match-rounds'
import { StandingsTable } from './standings-table'
import { useStandings } from './use-standings'

export type SwissDrawProps = {
  drawId: string
  matches: readonly BracketMatch[]
  entries: readonly BracketEntry[]
  results: readonly SetScore[]
  categoryName?: string | undefined
  onSelectMatch?: ((match: BracketMatch) => void) | undefined
  linkAthletes?: boolean | undefined
  live?: ReadonlyMap<string, LiveMatch> | undefined
  /** Admin: mostra o botão "Gerar próxima rodada" e avisa quando ela foi criada. */
  onRoundGenerated?: (() => void) | undefined
}

/** Bye do suíço: partida de um lado só, já encerrada. */
const isBye = (m: BracketMatch) => (m.registration1Id === null) !== (m.registration2Id === null)

/** Suíço: classificação (com Buchholz), rodadas já geradas e o botão da próxima rodada. */
export function SwissDraw({ drawId, matches, entries, results, categoryName, onSelectMatch, linkAthletes, live, onRoundGenerated }: SwissDrawProps) {
  const { data, error } = useStandings(drawId, matches, results)
  const entryIndex = useMemo(() => indexEntries(entries), [entries])
  const nameOf = (regId: string) => slotLabel(describeSlot(regId, entryIndex, false))
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  if (matches.length === 0) return <EmptyNotice>Nenhuma partida nesta chave.</EmptyNotice>

  const played = matches.filter((m) => !isBye(m))
  const byes = matches.filter(isBye)
  const roundDone = played.every((m) => isFinishedStatus(m.status))
  const progress = data?.rounds
  const allGenerated = !!progress && progress.generated >= progress.total
  const canGenerate = !!onRoundGenerated && !allGenerated

  async function nextRound() {
    setGenerating(true)
    setGenerateError(null)
    try {
      await apiFetch(`/draws/${drawId}/swiss/next-round`, { method: 'POST' })
      onRoundGenerated?.()
    } catch (err) {
      setGenerateError(err instanceof ApiError || err instanceof Error ? err.message : 'Erro ao gerar a rodada.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-8 p-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Classificação</h3>
          {progress && (
            <p className="text-xs text-muted-foreground">
              Rodada {progress.generated} de {progress.total}
            </p>
          )}
        </div>
        {error && !data ? (
          <ErrorNotice>Não foi possível carregar a classificação: {error}</ErrorNotice>
        ) : !data ? (
          <p role="status" className="text-sm text-muted-foreground">Carregando classificação...</p>
        ) : (
          <StandingsTable rows={data.rows} nameOf={nameOf} label={`Classificação${categoryName ? ` de ${categoryName}` : ''}`} />
        )}
        <p className="text-xs text-muted-foreground">
          Desempate: Buchholz (soma das vitórias dos adversários), saldo de sets e saldo de pontos. A folga conta como vitória.
        </p>
      </section>

      {canGenerate && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-5">
          <p className="text-sm text-muted-foreground">
            {roundDone
              ? 'A rodada terminou. Gere a próxima: os pareamentos saem da classificação, sem repetir adversário.'
              : 'A próxima rodada é gerada quando todas as partidas da atual tiverem resultado.'}
          </p>
          {generateError && <p role="alert" className="text-sm text-destructive">{generateError}</p>}
          <button
            type="button"
            onClick={nextRound}
            disabled={!roundDone || generating}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
            {generating ? 'Gerando...' : 'Gerar próxima rodada'}
          </button>
        </div>
      )}

      <MatchRounds matches={played} entries={entries} results={results} onSelectMatch={onSelectMatch} linkAthletes={linkAthletes} live={live} />

      {byes.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Folgas</h4>
          <ul className="space-y-1 text-sm">
            {byes.map((m) => (
              <li key={m.id}>
                {m.roundLabel ?? 'Rodada'}: {nameOf((m.registration1Id ?? m.registration2Id)!)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
