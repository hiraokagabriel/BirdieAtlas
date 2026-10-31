'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

type Hit = { id: string; name: string; clubName?: string | null }

const MIN_LENGTH = 2

/** Busca um adversário (GET /athletes/search) e leva para o confronto direto. */
export function HeadToHeadPicker({ athleteId }: { athleteId: string }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    const text = query.trim()
    if (text.length < MIN_LENGTH) {
      setHits([])
      setState('idle')
      return
    }
    let cancelled = false
    setState('loading')
    setHits([])
    const timer = setTimeout(() => {
      apiFetch<{ data: Hit[] }>(`/athletes/search?q=${encodeURIComponent(text)}&pageSize=6`)
        .then((res) => {
          if (cancelled) return
          setHits(res.data.filter((h) => h.id !== athleteId))
          setState('idle')
        })
        .catch(() => {
          if (!cancelled) setState('error')
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, athleteId])

  return (
    <section aria-labelledby="h2h-title" className="space-y-3">
      <h2 id="h2h-title" className="text-2xl">
        Confronto direto
      </h2>
      <Field label="Comparar com outro atleta" hint="Digite pelo menos 2 letras do nome.">
        {(props) => (
          <input
            {...props}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome do adversário"
            autoComplete="off"
            className={FIELD_CONTROL_CLASS}
          />
        )}
      </Field>
      <div aria-live="polite">
        {state === 'loading' && <p className="text-sm text-muted-foreground">Buscando...</p>}
        {state === 'error' && <p className="text-sm text-destructive">Não foi possível buscar agora.</p>}
        {state === 'idle' && query.trim().length >= MIN_LENGTH && hits.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum atleta encontrado.</p>
        )}
      </div>
      {hits.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {hits.map((h) => (
            <li key={h.id} className="min-w-0">
              <Link
                href={`/a/${athleteId}/vs/${h.id}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                {h.clubName && <span className="truncate text-xs font-normal text-muted-foreground">{h.clubName}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
