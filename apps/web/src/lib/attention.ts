import { apiFetch } from '@/lib/api'

/** Pendência do painel do admin (`GET /dashboard/attention`): uma linha por torneio e tipo, com a contagem. */
export type AttentionItem = {
  kind: 'pending_registrations' | 'missing_draws' | 'unpublished_draws'
  tournamentId: string
  tournamentName: string
  count: number
}

export type Attention = { liveMatches: number; items: AttentionItem[] }

/** Compartilhada pelo "Precisa de você" e pelo contador do menu "Ao vivo": uma requisição para os dois. */
export const ATTENTION_QUERY = {
  queryKey: ['dashboard', 'attention'],
  queryFn: () => apiFetch<Attention>('/dashboard/attention'),
  refetchInterval: 30_000,
} as const

/** Frase da pendência (o número vai ao lado) e o verbo do botão. */
export function describeAttention(item: AttentionItem): { text: string; action: string } {
  const one = item.count === 1
  switch (item.kind) {
    case 'pending_registrations':
      return { text: one ? 'inscrição aguardando aprovação' : 'inscrições aguardando aprovação', action: 'Revisar' }
    case 'missing_draws':
      return { text: one ? 'categoria sem chave gerada' : 'categorias sem chave gerada', action: 'Gerar' }
    case 'unpublished_draws':
      return { text: one ? 'chave gerada e não publicada' : 'chaves geradas e não publicadas', action: 'Publicar' }
  }
}
