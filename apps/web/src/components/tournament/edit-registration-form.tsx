'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import type { RegistrationResponse } from '@birdie-atlas/validators'
import { apiFetch } from '@/lib/api'
import { ATHLETE_SEARCH_LIMIT, athleteOptionLabel, useAthleteSearch } from '@/hooks/use-athlete-search'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

interface CategoryOption {
  id: string
  name: string
  discipline: string
}

const DISCIPLINE_LABEL: Record<string, string> = {
  MS: 'Simples masc.', WS: 'Simples fem.', MD: 'Duplas masc.', WD: 'Duplas fem.', XD: 'Mista',
}

const isDoubles = (discipline: string) => ['MD', 'WD', 'XD'].includes(discipline)

/** Todos os clubes (a lista é paginada em 100), para sugerir nomes ao trocar o clube. */
function useClubNames() {
  return useQuery({
    queryKey: ['clubs', 'names'],
    queryFn: async () => {
      const names: string[] = []
      for (let page = 1; page <= 20; page++) {
        const r = await apiFetch<Paginated<{ name: string }>>(`/clubs?pageSize=100&page=${page}`)
        names.push(...r.data.map((c) => c.name))
        if (names.length >= r.pagination.total || r.data.length === 0) break
      }
      return names
    },
    staleTime: 60_000,
  })
}

interface Props {
  registration: RegistrationResponse
  categories: CategoryOption[]
  onClose: () => void
}

/** Edição simplificada de uma inscrição: remanejar de categoria, substituir atleta ou parceiro(a), trocar clube e cabeça de chave. */
export function EditRegistrationForm({ registration: reg, categories, onClose }: Props) {
  const queryClient = useQueryClient()
  const [categoryId, setCategoryId] = useState(reg.categoryId)
  const [athlete1, setAthlete1] = useState(reg.athleteId)
  const [athlete2, setAthlete2] = useState(reg.athlete2Id ?? '')
  const [seed, setSeed] = useState(reg.seed ? String(reg.seed) : '')
  const [club1, setClub1] = useState(reg.athleteClub ?? '')
  const [club2, setClub2] = useState(reg.athlete2Club ?? '')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const target = categories.find((c) => c.id === categoryId)
  const doubles = target ? isDoubles(target.discipline) : false

  const { athletes, total } = useAthleteSearch(search)
  const clubNames = useClubNames()

  // Os atletas atuais ficam disponíveis mesmo fora do resultado da busca.
  const options = [...athletes.map((a) => ({ id: a.id, label: athleteOptionLabel(a) }))]
  const ensure = (id: string, name: string | null, club: string | null) => {
    if (id && !options.some((o) => o.id === id)) options.unshift({ id, label: athleteOptionLabel({ name: name ?? id, clubName: club }) })
  }
  ensure(reg.athleteId, reg.athleteName, reg.athleteClub)
  if (reg.athlete2Id) ensure(reg.athlete2Id, reg.athlete2Name, reg.athlete2Club)

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {}
      if (categoryId !== reg.categoryId) patch.categoryId = categoryId
      if (athlete1 !== reg.athleteId) patch.athleteId = athlete1
      const nextAthlete2 = doubles ? athlete2 || null : null
      if (nextAthlete2 !== reg.athlete2Id) patch.athlete2Id = nextAthlete2
      const nextSeed = seed.trim() === '' ? null : Number(seed)
      if (nextSeed !== reg.seed) patch.seed = nextSeed
      if (Object.keys(patch).length > 0) await apiFetch(`/registrations/${reg.id}`, { method: 'PATCH', json: patch })

      // Clubes: pertencem ao atleta (valem em todos os torneios). Depois da inscrição, que é o que pode falhar por regra.
      const finalAthlete1 = (patch.athleteId as string | undefined) ?? reg.athleteId
      const finalAthlete2 = doubles ? ((patch.athlete2Id as string | null | undefined) ?? reg.athlete2Id) : null
      const changeClub = async (athleteId: string, next: string, previous: string | null) => {
        if (next.trim() === (previous ?? '')) return
        await apiFetch(`/athletes/${athleteId}/current-club`, { method: 'PUT', json: next.trim() ? { clubName: next.trim() } : { clubId: null } })
      }
      // Só troca o clube de quem continua na inscrição (os campos de clube mostram o atleta original).
      if (finalAthlete1 === reg.athleteId) await changeClub(reg.athleteId, club1, reg.athleteClub)
      if (finalAthlete2 && finalAthlete2 === reg.athlete2Id) await changeClub(finalAthlete2, club2, reg.athlete2Club)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registrations'] })
      void queryClient.invalidateQueries({ queryKey: ['athletes'] })
      void queryClient.invalidateQueries({ queryKey: ['clubs'] })
      onClose()
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível salvar.'),
  })

  const swappedAthlete1 = athlete1 !== reg.athleteId
  const swappedAthlete2 = doubles && athlete2 !== (reg.athlete2Id ?? '')
  const id = `edit-${reg.id}`

  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-border bg-muted/20 p-3"
      aria-label={`Editar inscrição de ${reg.athleteName ?? reg.athleteId}`}
      onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate() }}
    >
      <datalist id={`${id}-clubs`}>
        {(clubNames.data ?? []).map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Categoria" muted hint="Remanejar: escolha outra categoria do torneio.">
          {(props) => (
            <select {...props} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={FIELD_CONTROL_CLASS}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({DISCIPLINE_LABEL[c.discipline] ?? c.discipline})</option>)}
            </select>
          )}
        </Field>
        <Field label="Cabeça de chave" muted hint="Em branco: sem cabeça de chave.">
          {(props) => <input {...props} type="number" min={1} value={seed} onChange={(e) => setSeed(e.target.value)} className={FIELD_CONTROL_CLASS} />}
        </Field>
      </div>

      <Field
        label="Buscar atleta para substituir"
        muted
        hint={total > ATHLETE_SEARCH_LIMIT ? `Mostrando os ${ATHLETE_SEARCH_LIMIT} primeiros resultados. Refine a busca.` : 'Digite parte do nome para trocar o atleta ou o(a) parceiro(a).'}
      >
        {(props) => <input {...props} type="search" placeholder="Nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className={FIELD_CONTROL_CLASS} />}
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={doubles ? 'Atleta 1' : 'Atleta'} muted>
          {(props) => (
            <select {...props} value={athlete1} onChange={(e) => setAthlete1(e.target.value)} className={FIELD_CONTROL_CLASS}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
        </Field>
        {doubles && (
          <Field label="Atleta 2 (parceiro(a))" muted>
            {(props) => (
              <select {...props} value={athlete2} onChange={(e) => setAthlete2(e.target.value)} className={FIELD_CONTROL_CLASS}>
                <option value="">Selecionar...</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
          </Field>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={`Clube de ${reg.athleteName ?? 'atleta 1'}`}
          muted
          hint={swappedAthlete1 ? 'O atleta foi trocado: ajuste o clube dele depois, na própria inscrição.' : 'Escolha um clube existente ou digite um novo. Vale para todos os torneios.'}
        >
          {(props) => <input {...props} list={`${id}-clubs`} value={club1} onChange={(e) => setClub1(e.target.value)} disabled={swappedAthlete1} className={FIELD_CONTROL_CLASS} />}
        </Field>
        {reg.athlete2Id && doubles && (
          <Field
            label={`Clube de ${reg.athlete2Name ?? 'atleta 2'}`}
            muted
            hint={swappedAthlete2 ? 'O parceiro(a) foi trocado: ajuste o clube depois, na própria inscrição.' : undefined}
          >
            {(props) => <input {...props} list={`${id}-clubs`} value={club2} onChange={(e) => setClub2(e.target.value)} disabled={swappedAthlete2} className={FIELD_CONTROL_CLASS} />}
          </Field>
        )}
      </div>

      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {save.isPending ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Cancelar
        </button>
      </div>
    </form>
  )
}
