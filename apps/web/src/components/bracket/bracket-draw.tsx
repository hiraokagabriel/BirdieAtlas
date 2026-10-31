'use client'

import { useState } from 'react'
import { matchTitle, describeSlot, indexEntries, slotLabel, setsOf, type BracketEntry, type BracketMatch, type SetScore } from '@/lib/bracket'
import type { LiveMatch } from '@/lib/live'
import { BracketTree } from './bracket-tree'
import { RoundRobinDraw } from './round-robin-draw'
import { GroupKnockoutDraw } from './group-knockout-draw'
import { MatchResultDialog } from './match-result-dialog'

type Category = { id: string; name: string; discipline: string }

type Props = {
  matches: BracketMatch[]
  registrations: BracketEntry[]
  results: SetScore[]
  activeCategory?: Category
  drawId: string
  /** Formato da categoria; sem ele, eliminação simples. */
  drawType?: string
  /** Grupos + eliminatória: quantos de cada grupo avançam (destaca a tabela). */
  advancePerGroup?: number
  /** Admin: chamado depois de gerar a eliminatória. */
  onKnockoutGenerated?: () => void
  /** Público: sem diálogo de resultado, com links para o perfil dos atletas. */
  readonly?: boolean
  /** Placar ao vivo por id da partida (público). */
  live?: ReadonlyMap<string, LiveMatch>
}

/** Chave de uma categoria. No admin abre o diálogo de resultado; no público é só leitura. */
export function BracketDraw({ matches, registrations, results, activeCategory, drawId, drawType, advancePerGroup, onKnockoutGenerated, readonly = false, live }: Props) {
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null)

  const entries = indexEntries(registrations)
  const slotName = (regId: string | null) => slotLabel(describeSlot(regId, entries, false))

  return (
    <>
      {drawType === 'group_then_elimination' ? (
        <GroupKnockoutDraw
          drawId={drawId}
          matches={matches}
          entries={registrations}
          results={results}
          categoryName={activeCategory?.name}
          advancePerGroup={advancePerGroup}
          onSelectMatch={readonly ? undefined : setSelectedMatch}
          linkAthletes={readonly}
          live={live}
          onKnockoutGenerated={readonly ? undefined : onKnockoutGenerated}
        />
      ) : drawType === 'round_robin' ? (
        <RoundRobinDraw
          drawId={drawId}
          matches={matches}
          entries={registrations}
          results={results}
          categoryName={activeCategory?.name}
          onSelectMatch={readonly ? undefined : setSelectedMatch}
          linkAthletes={readonly}
          live={live}
        />
      ) : (
        <BracketTree
          matches={matches}
          entries={registrations}
          results={results}
          categoryName={activeCategory?.name}
          onSelectMatch={readonly ? undefined : setSelectedMatch}
          linkAthletes={readonly}
          live={live}
        />
      )}

      {!readonly && (
        <MatchResultDialog
          match={selectedMatch}
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          player1Name={slotName(selectedMatch?.registration1Id ?? null)}
          player2Name={slotName(selectedMatch?.registration2Id ?? null)}
          drawId={drawId}
          existingResults={selectedMatch ? setsOf(selectedMatch.id, results) : []}
          roundLabel={selectedMatch ? matchTitle(selectedMatch) : ''}
        />
      )}
    </>
  )
}
