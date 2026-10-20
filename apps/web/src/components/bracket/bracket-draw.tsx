'use client'

import { useState } from 'react'
import { roundTitle, describeSlot, indexEntries, slotLabel, setsOf, type BracketEntry, type BracketMatch, type SetScore } from '@/lib/bracket'
import { BracketTree } from './bracket-tree'
import { MatchResultDialog } from './match-result-dialog'

type Category = { id: string; name: string; discipline: string }

type Props = {
  matches: BracketMatch[]
  registrations: BracketEntry[]
  results: SetScore[]
  activeCategory?: Category
  drawId: string
  /** Público: sem diálogo de resultado, com links para o perfil dos atletas. */
  readonly?: boolean
}

/** Chave de uma categoria. No admin abre o diálogo de resultado; no público é só leitura. */
export function BracketDraw({ matches, registrations, results, activeCategory, drawId, readonly = false }: Props) {
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null)

  const entries = indexEntries(registrations)
  const slotName = (regId: string | null) => slotLabel(describeSlot(regId, entries, false))

  return (
    <>
      <BracketTree
        matches={matches}
        entries={registrations}
        results={results}
        categoryName={activeCategory?.name}
        onSelectMatch={readonly ? undefined : setSelectedMatch}
        linkAthletes={readonly}
      />

      {!readonly && (
        <MatchResultDialog
          match={selectedMatch}
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          player1Name={slotName(selectedMatch?.registration1Id ?? null)}
          player2Name={slotName(selectedMatch?.registration2Id ?? null)}
          drawId={drawId}
          existingResults={selectedMatch ? setsOf(selectedMatch.id, results) : []}
          roundLabel={selectedMatch ? roundTitle(selectedMatch.round) : ''}
        />
      )}
    </>
  )
}
