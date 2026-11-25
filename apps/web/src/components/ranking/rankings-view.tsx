'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Plus, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DisciplineChip } from '@/components/public/discipline-chip'
import { EmptyNotice, ErrorNotice } from '@/components/public/notices'
import { Skeleton } from '@/components/ui/skeleton'
import { ROWS, ROW_LINK } from '@/components/public/rows'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

type Ranking = {
  id: string; name: string; description: string | null
  discipline: string; year: number
  autoInclude: boolean; active: boolean
  countBestResults: number | null
  minTournamentsRequired: number
}

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.',  WD: 'Duplas Fem.', XD: 'Misto',
}
const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const

/** Gera slug a partir de uma string: lowercase, sem acentos, hífens no lugar de espaços/especiais */
function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type CreateForm = {
  name: string
  description: string
  discipline: string
  year: number
  autoInclude: boolean
  countBestResults: string
  minTournamentsRequired: string
}

const EMPTY_FORM: CreateForm = {
  name: '', description: '', discipline: 'MS',
  year: new Date().getFullYear(), autoInclude: false,
  countBestResults: '', minTournamentsRequired: '0',
}

/** Chip de regra de contagem (4 px, docs/DESIGN.md, Chips). */
const RULE_CHIP = 'inline-flex h-5.5 items-center gap-1 rounded-sm px-1.5 text-xs font-semibold'

export function RankingsView() {
  const queryClient = useQueryClient()
  // O tenant é definido pela API; rankings de uma federação cabem numa página.
  const { data: rankings, isPending, isError, error } = useQuery({
    queryKey: ['rankings', 'admin-list'],
    queryFn: async () => (await apiFetch<Paginated<Ranking>>('/rankings?pageSize=100')).data,
  })
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const newRanking = await apiFetch<Ranking>('/rankings', {
        method: 'POST',
        json: {
          ...form,
          slug: toSlug(form.name),
          countBestResults: form.countBestResults ? Number(form.countBestResults) : undefined,
          minTournamentsRequired: Number(form.minTournamentsRequired),
        },
      })
      queryClient.setQueryData<Ranking[]>(['rankings', 'admin-list'], (prev) => [...(prev ?? []), newRanking])
      setShowCreate(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao criar ranking', description: err instanceof Error ? err.message : String(err) })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl">Rankings</h2>
          <p className="text-sm text-muted-foreground">Gerencie os rankings de cada disciplina.</p>
        </div>
        <button
          type="button"
          aria-expanded={showCreate}
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Novo ranking
        </button>
      </div>

      {/* Formulário de criação */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Novo Ranking</h3>

          {/* Linha 1: Nome + Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Nome"
              required
              muted
              hint={form.name ? <>Slug: <span className="font-mono text-foreground">{toSlug(form.name)}</span></> : undefined}
            >
              {(props) => (
                <input
                  {...props}
                  type="text" required placeholder="ex: Ranking Amistosos 2026"
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={FIELD_CONTROL_CLASS}
                />
              )}
            </Field>
            <Field label="Descrição" muted>
              {(props) => (
                <input
                  {...props}
                  type="text" placeholder="Descrição opcional"
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={FIELD_CONTROL_CLASS}
                />
              )}
            </Field>
          </div>

          {/* Linha 2: Disciplina + Ano */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Disciplina" required muted>
              {(props) => (
                <select
                  {...props}
                  value={form.discipline} onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value }))}
                  className={`${FIELD_CONTROL_CLASS} cursor-pointer`}
                >
                  {DISCIPLINES.map((d) => <option key={d} value={d}>{disciplineLabel[d]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Ano" required muted>
              {(props) => (
                <input
                  {...props}
                  type="number" min={2020} max={2099}
                  value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                  className={FIELD_CONTROL_CLASS}
                />
              )}
            </Field>
          </div>

          {/* Linha 3: Regras de contagem */}
          <fieldset className="rounded-lg border border-border bg-muted/30 p-4">
            <legend className="px-1 text-sm font-semibold">Regras de contagem</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Melhores resultados" muted hint="Deixe em branco para contar todos os torneios.">
                {(props) => (
                  <input
                    {...props}
                    type="number" min={1} max={99} placeholder="Todos (padrão)"
                    value={form.countBestResults}
                    onChange={(e) => setForm((f) => ({ ...f, countBestResults: e.target.value }))}
                    className={FIELD_CONTROL_CLASS}
                  />
                )}
              </Field>
              <Field label="Mínimo de torneios" muted hint="Atletas com menos torneios são excluídos do ranking.">
                {(props) => (
                  <input
                    {...props}
                    type="number" min={0} max={99}
                    value={form.minTournamentsRequired}
                    onChange={(e) => setForm((f) => ({ ...f, minTournamentsRequired: e.target.value }))}
                    className={FIELD_CONTROL_CLASS}
                  />
                )}
              </Field>
            </div>
          </fieldset>

          {/* Linha 4: Auto-inclusão */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox" checked={form.autoInclude}
              onChange={(e) => setForm((f) => ({ ...f, autoInclude: e.target.checked }))}
              className="size-4 rounded accent-primary"
            />
            <span className="text-sm">
              <span className="font-medium">Inclusão automática</span>
              <span className="text-muted-foreground ml-1.5">— inclui todos os torneios com pontos distribuídos automaticamente</span>
            </span>
          </label>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit" disabled={creating}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Criando...' : 'Criar ranking'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista com divisórias (docs/DESIGN.md): nome, disciplina, ano e regras de contagem numa linha. */}
      {isError ? (
        <ErrorNotice>Não foi possível carregar os rankings: {error instanceof Error ? error.message : 'erro inesperado'}.</ErrorNotice>
      ) : isPending ? (
        <div role="status" aria-busy="true" className="space-y-2">
          <span className="sr-only">Carregando rankings…</span>
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rankings.length === 0 ? (
        <EmptyNotice>Nenhum ranking criado ainda. Crie o primeiro em “Novo ranking”.</EmptyNotice>
      ) : (
        <ul className={ROWS}>
          {rankings.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/rankings/${r.id}`} className={cn('flex min-h-14 items-center gap-3 px-4 py-2.5', ROW_LINK)}>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words font-semibold leading-snug">{r.name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span aria-hidden="true"><DisciplineChip discipline={r.discipline} /></span>
                    <span>{disciplineLabel[r.discipline] ?? r.discipline}</span>
                    <span className="tabular-nums">{r.year}</span>
                    {r.autoInclude && <span className={`${RULE_CHIP} bg-secondary text-secondary-foreground`}>Inclusão automática</span>}
                    {r.countBestResults && <span className={`${RULE_CHIP} bg-muted text-muted-foreground`}>{r.countBestResults} melhores</span>}
                    {r.minTournamentsRequired > 0 && <span className={`${RULE_CHIP} bg-muted text-muted-foreground`}>Mín. {r.minTournamentsRequired} torneios</span>}
                  </p>
                  {r.description && <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
