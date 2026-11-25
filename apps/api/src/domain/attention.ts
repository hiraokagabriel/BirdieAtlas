// "Precisa de você" do painel do admin: o que a federação tem de fazer agora em cada torneio ativo.
// Regra pura (sem banco): a rota carrega as linhas e esta função decide o que vira pendência.

export type AttentionTournament = { id: string; name: string; status: string }
export type AttentionCategory = { id: string; tournamentId: string; name: string }
export type AttentionDraw = { categoryId: string; published: boolean }

export type AttentionKind = 'pending_registrations' | 'missing_draws' | 'unpublished_draws'

/** Uma linha por torneio e tipo, com a contagem (inscrições ou categorias); o painel não lista categoria por categoria. */
export type AttentionItem = { kind: AttentionKind; tournamentId: string; tournamentName: string; count: number }

/** A chave só faz sentido depois do fim das inscrições. */
const DRAW_PHASES = new Set(['registration_closed', 'in_progress'])
/** Com menos de 2 inscrições aprovadas não há o que sortear. */
const MIN_ENTRIES_FOR_DRAW = 2

export interface AttentionInput {
  tournaments: readonly AttentionTournament[]
  categories: readonly AttentionCategory[]
  draws: readonly AttentionDraw[]
  /** Inscrições pendentes por categoria. */
  pendingByCategory: ReadonlyMap<string, number>
  /** Inscrições aprovadas por categoria. */
  approvedByCategory: ReadonlyMap<string, number>
}

/**
 * Pendências na ordem em que o painel mostra: por torneio (na ordem recebida), primeiro inscrições a aprovar,
 * depois categorias sem chave e por fim categorias com chave gerada e não publicada.
 */
export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const drawsByCategory = new Map<string, AttentionDraw[]>()
  for (const d of input.draws) {
    const list = drawsByCategory.get(d.categoryId)
    if (list) list.push(d)
    else drawsByCategory.set(d.categoryId, [d])
  }

  const items: AttentionItem[] = []
  for (const t of input.tournaments) {
    const categories = input.categories.filter((c) => c.tournamentId === t.id)
    const push = (kind: AttentionKind, count: number) => {
      if (count > 0) items.push({ kind, tournamentId: t.id, tournamentName: t.name, count })
    }

    push('pending_registrations', categories.reduce((sum, c) => sum + (input.pendingByCategory.get(c.id) ?? 0), 0))
    if (!DRAW_PHASES.has(t.status)) continue

    let missing = 0
    let unpublished = 0
    for (const c of categories) {
      const categoryDraws = drawsByCategory.get(c.id) ?? []
      if (categoryDraws.length === 0) {
        if ((input.approvedByCategory.get(c.id) ?? 0) >= MIN_ENTRIES_FOR_DRAW) missing++
      } else if (!categoryDraws.some((d) => d.published)) {
        unpublished++
      }
    }
    push('missing_draws', missing)
    push('unpublished_draws', unpublished)
  }
  return items
}
