'use client'

import { useEffect, useState } from 'react'
import type { Paginated } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Plus, ChevronRight, Users, User, Zap, Trophy, Shield } from 'lucide-react'
import { DISCIPLINE_PILL } from '@/lib/discipline'
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

export function RankingsView() {
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)

  useEffect(() => {
    // O tenant é definido pela API; rankings de uma federação cabem numa página.
    apiFetch<Paginated<Ranking>>('/rankings?pageSize=100').then(({ data }) => setRankings(data))
  }, [])

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
      setRankings((prev) => [...prev, newRanking])
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
          <h2 className="text-2xl font-bold tracking-tight">Rankings</h2>
          <p className="text-muted-foreground">Gerencie os rankings de cada disciplina.</p>
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
            <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regras de contagem</legend>
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

      {/* Grid de cards */}
      {rankings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          Nenhum ranking criado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rankings.map((r) => (
            <Link
              key={r.id}
              href={`/admin/rankings/${r.id}`}
              className="group rounded-xl border border-border bg-card hover:shadow-md transition-shadow p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{r.name}</p>
                  {r.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" aria-hidden="true" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
                  DISCIPLINE_PILL[r.discipline] ?? 'bg-muted text-muted-foreground border-border'
                }`}>
                  {['MD','WD','XD'].includes(r.discipline)
                    ? <Users className="w-3 h-3" />
                    : <User className="w-3 h-3" />}
                  {disciplineLabel[r.discipline] ?? r.discipline}
                </span>

                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-border text-xs text-muted-foreground">
                  {r.year}
                </span>

                {r.autoInclude && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-success/30 bg-success/10 text-success text-xs">
                    <Zap className="w-3 h-3" />
                    Auto
                  </span>
                )}

                {r.countBestResults && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning text-xs">
                    <Trophy className="w-3 h-3" />
                    Top {r.countBestResults}
                  </span>
                )}

                {r.minTournamentsRequired > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground text-xs">
                    <Shield className="w-3 h-3" />
                    Mín. {r.minTournamentsRequired}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
