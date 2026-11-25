'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { ATTENTION_QUERY, describeAttention } from '@/lib/attention'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { PanelHeader } from './panel-header'

/** Quantas pendências o painel mostra; o resto fica na lista de torneios. */
const LIMIT = 6

/** "Precisa de você": o que a federação tem de fazer agora, com a ação ao lado (template admin). */
export function AttentionPanel() {
  const { data, isError, error, refetch } = useQuery(ATTENTION_QUERY)

  return (
    <section aria-labelledby="attention-title" className="relative overflow-hidden rounded-lg border border-border bg-card">
      <PanelHeader id="attention-title" title="Precisa de você" />
      {isError && !data ? (
        <div className="space-y-3 p-4">
          <ErrorNotice>Não foi possível carregar as pendências: {error instanceof Error ? error.message : 'erro inesperado'}.</ErrorNotice>
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw aria-hidden="true" /> Tentar de novo
          </Button>
        </div>
      ) : !data ? (
        <div role="status" aria-busy="true" className="space-y-2 p-4">
          <span className="sr-only">Carregando pendências…</span>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : data.items.length === 0 ? (
        <div className="p-4">
          <EmptyNotice>Nada pendente agora. Inscrições a aprovar e chaves a gerar ou publicar aparecem aqui.</EmptyNotice>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {data.items.slice(0, LIMIT).map((item) => {
              const { text, action } = describeAttention(item)
              return (
                <li key={`${item.tournamentId}-${item.kind}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-8 shrink-0 text-center font-heading text-2xl font-bold leading-none tabular-nums">{item.count}</span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm">{text}</p>
                    <p className="break-words text-xs text-muted-foreground">{item.tournamentName}</p>
                  </div>
                  <Button asChild variant="outline" className="min-w-22 shrink-0">
                    <Link href={`/admin/tournaments/${item.tournamentId}`}>
                      {action}
                      <span className="sr-only"> {item.count} {text}, {item.tournamentName}</span>
                    </Link>
                  </Button>
                </li>
              )
            })}
          </ul>
          {data.items.length > LIMIT && (
            <div className="border-t border-border px-4 py-1">
              <Link href="/admin/tournaments" className="inline-flex min-h-(--control-h) items-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:underline">
                Mais {data.items.length - LIMIT} nos torneios
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  )
}
