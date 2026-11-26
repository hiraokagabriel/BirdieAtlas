// O que pode mudar numa categoria já criada, conforme o estado dela. Regra pura, usada por
// PATCH/DELETE /tournaments/categories/:categoryId.

export interface CategoryState {
  /** Já existe chave sorteada. */
  hasDraw: boolean
  /** Alguma partida da chave tem resultado ou placar ao vivo. */
  hasPlayedMatch: boolean
  /** Inscrições não recusadas. */
  activeRegistrations: number
}

export interface CategoryChange {
  drawType?: boolean
  scoring?: boolean
  maxEntries?: number | null
  delete?: boolean
}

export interface CategoryBlock {
  code: 'CATEGORY_HAS_DRAW' | 'CATEGORY_HAS_RESULTS' | 'CATEGORY_HAS_REGISTRATIONS' | 'MAX_ENTRIES_BELOW_REGISTRATIONS'
  error: string
}

/** Primeiro motivo que impede a mudança, ou `null` se ela pode ser feita. */
export function categoryChangeBlock(state: CategoryState, change: CategoryChange): CategoryBlock | null {
  if (change.delete) {
    if (state.hasDraw) return { code: 'CATEGORY_HAS_DRAW', error: 'A categoria já tem chave sorteada e não pode ser excluída.' }
    if (state.activeRegistrations > 0) {
      return { code: 'CATEGORY_HAS_REGISTRATIONS', error: `A categoria tem ${state.activeRegistrations} inscrição(ões). Remova ou remaneje as inscrições antes de excluir.` }
    }
    return null
  }
  if (change.drawType && state.hasDraw) {
    return { code: 'CATEGORY_HAS_DRAW', error: 'O formato não muda depois que a chave foi sorteada.' }
  }
  if (change.scoring && state.hasPlayedMatch) {
    return { code: 'CATEGORY_HAS_RESULTS', error: 'A pontuação não muda depois que a categoria tem resultado ou partida ao vivo.' }
  }
  if (change.maxEntries != null && change.maxEntries < state.activeRegistrations) {
    return { code: 'MAX_ENTRIES_BELOW_REGISTRATIONS', error: `O limite não pode ficar abaixo das ${state.activeRegistrations} inscrições atuais.` }
  }
  return null
}
