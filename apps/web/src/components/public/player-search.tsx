'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronRight, User } from 'lucide-react'
import type { Paginated } from '@birdie-atlas/types'
import { ApiError, apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'
import { ROWS, ROW_LINK } from './rows'

type Hit = { athleteId: string; name: string; categories: string[] }

const MIN_LENGTH = 2

/**
 * "Encontre sua próxima partida" (docs/DESIGN.md, Regra da Próxima Ação): busca o jogador entre os inscritos do
 * torneio (`GET /tournaments/:id/players`) e leva à página das partidas dele.
 */
export function PlayerSearch({ tournamentId, slug }: { tournamentId: string; slug: string }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const text = query.trim()
    if (text.length < MIN_LENGTH) {
      setHits([])
      setState('idle')
      return
    }
    let cancelled = false
    setState('loading')
    const timer = setTimeout(() => {
      apiFetch<Paginated<Hit>>(`/tournaments/${tournamentId}/players?q=${encodeURIComponent(text)}`)
        .then((res) => {
          if (cancelled) return
          setHits(res.data)
          setTotal(res.pagination.total)
          setState('idle')
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setHits([])
          setError(err instanceof ApiError ? err.message : 'Não foi possível buscar agora.')
          setState('error')
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, tournamentId, attempt])

  const length = query.trim().length
  const searched = length >= MIN_LENGTH

  return (
    <section aria-labelledby="player-search-title" className="space-y-2 rounded-lg bg-secondary p-4 print:hidden">
      <h2 id="player-search-title" className="sr-only">Encontre sua próxima partida</h2>
      <Field label="Encontre sua próxima partida" hint="Digite seu nome ou o da sua dupla.">
        {(props) => (
          <input
            {...props}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            maxLength={80}
            className={cn(FIELD_CONTROL_CLASS, 'bg-card')}
          />
        )}
      </Field>
      <div aria-live="polite" className="text-sm">
        {length > 0 && !searched && <p className="text-muted-foreground">Digite ao menos {MIN_LENGTH} letras.</p>}
        {state === 'loading' && <p className="text-muted-foreground">Buscando…</p>}
        {state === 'error' && <p className="text-destructive">{error}</p>}
        {state === 'idle' && searched && (
          <p className="text-muted-foreground">
            {hits.length === 0
              ? 'Ninguém com esse nome neste torneio. Confira a grafia ou tente só o sobrenome.'
              : total === 1 ? '1 jogador encontrado.'
              : total > hits.length ? `${total} jogadores encontrados; mostrando ${hits.length}. Refine a busca com o sobrenome.`
              : `${total} jogadores encontrados.`}
          </p>
        )}
      </div>
      {state === 'error' && (
        <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          Tentar de novo
        </Button>
      )}
      {state === 'idle' && hits.length > 0 && (
        <ul className={ROWS}>
          {hits.map((h) => (
            <li key={h.athleteId}>
              <Link href={`/t/${slug}/jogador/${h.athleteId}`} className={cn('flex min-h-12 items-center gap-3 px-4 py-2', ROW_LINK)}>
                <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{h.name}</span>
                  <span className="block text-xs text-muted-foreground">{h.categories.join(' · ')}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
