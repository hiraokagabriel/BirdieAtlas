'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { ApiError, apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AthleteSelector } from '@/components/pairs/pair-form-modal'
import { Pager } from '@/components/shared/pager'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { ROWS } from '@/components/public/rows'

type Guest = { id: string; name: string; gender: 'M' | 'F'; birthYear: number | null }
type Target = { id: string; name: string; gender: 'M' | 'F' }

function MergeGuestDialog({ guest, onClose, onMerged }: { guest: Guest | null; onClose: () => void; onMerged: (message: string) => void }) {
  const [target, setTarget] = useState<Target | null>(null)
  const queryClient = useQueryClient()
  useEffect(() => { setTarget(null) }, [guest])

  const merge = useMutation({
    mutationFn: () => apiFetch<{ target: { name: string } }>(`/athletes/${guest!.id}/merge`, { method: 'POST', json: { targetAthleteId: target!.id } }),
    // O erro aparece dentro do diálogo (com as categorias em conflito), não no aviso global.
    onError: () => {},
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['athletes'] })
      onMerged(`${guest!.name} agora é ${res.target.name}: inscrições e duplas foram transferidas.`)
      onClose()
    },
  })
  useEffect(() => { merge.reset() }, [guest, target]) // eslint-disable-line react-hooks/exhaustive-deps

  const conflict = merge.error instanceof ApiError ? (merge.error.details as { categories?: string[] } | undefined)?.categories : undefined

  return (
    <Dialog open={guest !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Juntar {guest?.name} com atleta cadastrado</DialogTitle>
          <DialogDescription>
            As inscrições e duplas do avulso passam para o atleta escolhido, e o avulso deixa de existir. Não dá para desfazer.
          </DialogDescription>
        </DialogHeader>
        <AthleteSelector label="Atleta cadastrado" value={target} onChange={setTarget} gender={guest?.gender} />
        {merge.error && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p>{merge.error.message}</p>
            {conflict && conflict.length > 0 && <p className="mt-1">Categorias: {conflict.join(', ')}.</p>}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!target || merge.isPending} onClick={() => merge.mutate()}>
            {merge.isPending ? 'Juntando…' : merge.error ? 'Tentar de novo' : 'Juntar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Avulsos (jogadores de amistoso sem cadastro): lista e junção com um atleta cadastrado.
 * `GET /athletes?guest=true` e `POST /athletes/:id/merge`.
 */
export function GuestsPanel() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [merging, setMerging] = useState<Guest | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => { setPage(1) }, [debounced])

  const { data, isLoading, error, refetch } = useQuery<Paginated<Guest>>({
    queryKey: ['athletes', 'guests', page, debounced],
    queryFn: () => {
      const params = new URLSearchParams({ guest: 'true', page: String(page), pageSize: '25' })
      if (debounced) params.set('search', debounced)
      return apiFetch(`/athletes?${params}`)
    },
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Jogadores inscritos só pelo nome em torneios amistosos. Junte um avulso ao atleta cadastrado quando for a mesma pessoa.
      </p>
      <div className="max-w-sm">
        <Field label="Buscar avulso">
          {(props) => <input {...props} type="search" value={search} onChange={(e) => setSearch(e.target.value)} className={FIELD_CONTROL_CLASS} />}
        </Field>
      </div>
      <p role="status" className={cn('text-sm', notice ? 'text-foreground' : 'sr-only')}>{notice}</p>

      {error && !data ? (
        <div className="space-y-2">
          <ErrorNotice>Não foi possível carregar os avulsos: {error.message}</ErrorNotice>
          <Button type="button" variant="outline" onClick={() => void refetch()}>Tentar de novo</Button>
        </div>
      ) : isLoading || !data ? (
        <div role="status" className="p-8 text-sm text-muted-foreground">Carregando...</div>
      ) : data.data.length === 0 ? (
        <EmptyNotice>{debounced ? 'Nenhum avulso com esse nome.' : 'Nenhum jogador avulso. Eles surgem ao inscrever pelo nome em torneios amistosos.'}</EmptyNotice>
      ) : (
        <>
          <ul className={ROWS}>
            {data.data.map((g) => (
              <li key={g.id} className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{g.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {g.gender === 'M' ? 'Masculino' : 'Feminino'}{g.birthYear ? ` · nascido em ${g.birthYear}` : ''}
                  </span>
                </span>
                <Button type="button" variant="outline" onClick={() => { setNotice(''); setMerging(g) }}>
                  Juntar com atleta
                </Button>
              </li>
            ))}
          </ul>
          <Pager pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <MergeGuestDialog guest={merging} onClose={() => setMerging(null)} onMerged={setNotice} />
    </div>
  )
}
