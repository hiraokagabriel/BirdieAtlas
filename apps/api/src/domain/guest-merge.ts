// Juntar um avulso (jogador de amistoso, `athletes.guest`) a um atleta cadastrado: o histórico do avulso passa
// para o atleta e o avulso sai de cena. Regra pura; a rota carrega os dados e grava numa transação.
// Ver ESPECIFICACAO_COMPLETA.md, "Avulsos".

export interface MergeAthlete {
  id: string
  guest: boolean
  gender: 'M' | 'F'
}

export interface MergeRefusal {
  status: 409 | 422
  code: 'ATHLETE_NOT_GUEST' | 'TARGET_IS_GUEST' | 'SAME_ATHLETE' | 'GENDER_MISMATCH'
  error: string
}

/** Só avulso → cadastrado, de pessoas diferentes e do mesmo gênero. `null` quando pode juntar. */
export function checkGuestMerge(source: MergeAthlete, target: MergeAthlete): MergeRefusal | null {
  if (source.id === target.id) return { status: 422, code: 'SAME_ATHLETE', error: 'Escolha outro atleta: é o mesmo jogador.' }
  if (!source.guest) return { status: 409, code: 'ATHLETE_NOT_GUEST', error: 'Só um jogador avulso pode ser juntado a um atleta cadastrado.' }
  if (target.guest) return { status: 409, code: 'TARGET_IS_GUEST', error: 'O destino precisa ser um atleta cadastrado, não outro avulso.' }
  if (source.gender !== target.gender) return { status: 422, code: 'GENDER_MISMATCH', error: 'O avulso e o atleta têm gêneros diferentes.' }
  return null
}

export interface MergePair {
  id: string
  athlete1Id: string
  athlete2Id: string
  discipline: string
  /** Excluída (soft delete): só troca o avulso pelo atleta, para o histórico acompanhar. */
  deleted: boolean
  active: boolean
}

export type PairStep =
  /** Troca o avulso pelo atleta na própria dupla. */
  | { pairId: string; action: 'update'; column: 'athlete1Id' | 'athlete2Id' }
  /** O atleta já tem dupla com o mesmo parceiro: as inscrições vão para ela e a do avulso é excluída. */
  | { pairId: string; action: 'reuse'; intoPairId: string }

/**
 * O que fazer com cada dupla do avulso. `pairs` traz as duplas ativas do avulso e as do atleta.
 * Uma dupla do avulso com o próprio atleta não tem como existir depois da junção: devolve `conflict`.
 */
export function planPairMerge(pairs: readonly MergePair[], sourceId: string, targetId: string): { steps: PairStep[]; conflict: boolean } {
  const steps: PairStep[] = []
  for (const p of pairs) {
    const column = p.athlete1Id === sourceId ? 'athlete1Id' : p.athlete2Id === sourceId ? 'athlete2Id' : null
    if (!column) continue
    const partner = column === 'athlete1Id' ? p.athlete2Id : p.athlete1Id
    if (partner === targetId) {
      // Dupla excluída do avulso com o próprio atleta: fica como está (não vira dupla dele com ele mesmo).
      if (p.deleted) continue
      return { steps: [], conflict: true }
    }
    // Só reaproveita dupla ativa e não excluída do atleta; dupla excluída do avulso só troca o atleta.
    const existing = p.deleted ? undefined : pairs.find((q) => q.id !== p.id && !q.deleted && q.active && q.discipline === p.discipline
      && ((q.athlete1Id === targetId && q.athlete2Id === partner) || (q.athlete2Id === targetId && q.athlete1Id === partner)))
    steps.push(existing ? { pairId: p.id, action: 'reuse', intoPairId: existing.id } : { pairId: p.id, action: 'update', column })
  }
  return { steps, conflict: false }
}

/** Categorias em que os dois já jogam (inscrições ativas): juntar faria o atleta aparecer duas vezes nelas. */
export function sharedCategories(sourceCategoryIds: Iterable<string>, targetCategoryIds: Iterable<string>): string[] {
  const target = new Set(targetCategoryIds)
  return [...new Set(sourceCategoryIds)].filter((id) => target.has(id))
}
