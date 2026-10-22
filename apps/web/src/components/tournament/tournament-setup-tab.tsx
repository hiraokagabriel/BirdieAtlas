'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { TOURNAMENT_LEVELS, TOURNAMENT_LEVEL_LABELS as LEVEL_LABELS, type TournamentLevel } from '@birdie-atlas/validators'
import { apiFetch } from '@/lib/api'
import { Save, Plus, Check, AlertTriangle } from 'lucide-react'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'

type Tournament = {
  id: string; name: string; slug: string; status: string; level: TournamentLevel
  startDate: string; endDate: string; city: string | null; state: string | null
  location: string | null; tenantId: string; pointsAwarded: boolean
}
type Category = { id: string; name: string; discipline: string; maxEntries: number | null; seedCount: number }

const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const
const DISCIPLINE_LABELS: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.', MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Misto',
}

const inputCls = FIELD_CONTROL_CLASS
const selectCls = `${FIELD_CONTROL_CLASS} cursor-pointer`

interface Props {
  tournament: Tournament
  categories: Category[]
  onRefresh: () => void
}

export function TournamentSetupTab({ tournament, categories, onRefresh }: Props) {
  // ── Dados gerais ──────────────────────────────────────────────
  const [general, setGeneral] = useState({
    name: tournament.name,
    slug: tournament.slug,
    level: tournament.level,
    startDate: tournament.startDate?.slice(0, 10) ?? '',
    endDate: tournament.endDate?.slice(0, 10) ?? '',
    city: tournament.city ?? '',
    state: tournament.state ?? '',
    location: tournament.location ?? '',
  })
  const [generalSaved, setGeneralSaved] = useState(false)

  const generalMutation = useMutation({
    mutationFn: () => apiFetch(`/tournaments/${tournament.id}`, { method: 'PUT', json: {
      name: general.name.trim(),
      slug: general.slug.trim(),
      level: general.level,
      startDate: general.startDate || undefined,
      endDate: general.endDate || undefined,
      city: general.city.trim() || undefined,
      state: general.state.trim().toUpperCase() || undefined,
      location: general.location.trim() || undefined,
    }}),
    onSuccess: () => { setGeneralSaved(true); setTimeout(() => setGeneralSaved(false), 2000); onRefresh() },
  })

  // ── Categorias ────────────────────────────────────────────────
  const [newCat, setNewCat] = useState({ name: '', discipline: 'MS' as typeof DISCIPLINES[number], maxEntries: '' })
  const [catSaving, setCatSaving] = useState(false)
  const [catError, setCatError] = useState('')

  async function addCategory() {
    if (!newCat.name.trim()) { setCatError('Nome obrigatório'); return }
    setCatSaving(true); setCatError('')
    try {
      await apiFetch(`/tournaments/${tournament.id}/categories`, {
        method: 'POST',
        json: { name: newCat.name.trim(), discipline: newCat.discipline, maxEntries: newCat.maxEntries ? Number(newCat.maxEntries) : undefined },
      })
      setNewCat({ name: '', discipline: 'MS', maxEntries: '' })
      onRefresh()
    } catch { setCatError('Erro ao criar categoria') }
    finally { setCatSaving(false) }
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Dados gerais ── */}
      <section aria-labelledby="setup-general" className="space-y-4">
        <h3 id="setup-general" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dados gerais</h3>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Nome">
            {(props) => <input {...props} value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} className={inputCls} />}
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Slug">
              {(props) => <input {...props} value={general.slug} onChange={(e) => setGeneral({ ...general, slug: e.target.value })} className={inputCls + ' font-mono'} />}
            </Field>
            <Field label="Nível">
              {(props) => (
                <select {...props} value={general.level} onChange={(e) => setGeneral({ ...general, level: e.target.value as TournamentLevel })} className={selectCls}>
                  {TOURNAMENT_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Data início">
              {(props) => <input {...props} type="date" value={general.startDate} onChange={(e) => setGeneral({ ...general, startDate: e.target.value })} className={inputCls} />}
            </Field>
            <Field label="Data fim">
              {(props) => <input {...props} type="date" value={general.endDate} onChange={(e) => setGeneral({ ...general, endDate: e.target.value })} className={inputCls} />}
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Cidade">
              {(props) => <input {...props} value={general.city} onChange={(e) => setGeneral({ ...general, city: e.target.value })} className={inputCls} />}
            </Field>
            <Field label="Estado">
              {(props) => <input {...props} value={general.state} maxLength={2} onChange={(e) => setGeneral({ ...general, state: e.target.value.toUpperCase() })} className={inputCls + ' uppercase'} />}
            </Field>
            <Field label="Local">
              {(props) => <input {...props} value={general.location} onChange={(e) => setGeneral({ ...general, location: e.target.value })} placeholder="ex: Ginásio Central" className={inputCls} />}
            </Field>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {generalMutation.isError && (
            <p role="alert" className="text-xs font-medium text-destructive">Não foi possível salvar: {generalMutation.error.message}</p>
          )}
          <button
            type="button"
            onClick={() => generalMutation.mutate()}
            disabled={generalMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {generalSaved ? <Check className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            {generalSaved ? 'Salvo!' : generalMutation.isPending ? 'Salvando...' : 'Salvar dados'}
          </button>
          <span role="status" className="sr-only">{generalSaved ? 'Dados do torneio salvos.' : ''}</span>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Categorias ── */}
      <section aria-labelledby="setup-categories" className="space-y-4">
        <h3 id="setup-categories" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categorias</h3>

        {categories.length > 0 && (
          <ul className="rounded-xl border border-border overflow-hidden">
            {categories.map((cat, i) => (
              <li key={cat.id} className={`flex items-center justify-between px-4 py-3 ${i < categories.length - 1 ? 'border-b border-border' : ''}`}>
                <div>
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{DISCIPLINE_LABELS[cat.discipline] ?? cat.discipline}</span>
                  {cat.maxEntries && <span className="ml-2 text-xs text-muted-foreground">· máx {cat.maxEntries}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div role="group" aria-labelledby="setup-new-category" className="rounded-xl border border-border p-4 space-y-3">
          <p id="setup-new-category" className="text-xs font-medium text-muted-foreground">Adicionar categoria</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Disciplina" muted>
              {(props) => (
                <select {...props} value={newCat.discipline} onChange={(e) => setNewCat({ ...newCat, discipline: e.target.value as typeof DISCIPLINES[number] })} className={selectCls}>
                  {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Nome da categoria" muted error={catError || undefined}>
              {(props) => <input {...props} value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="ex: Simples Masc. A" className={inputCls} />}
            </Field>
            <Field label="Máx. inscrições" muted>
              {(props) => <input {...props} type="number" value={newCat.maxEntries} onChange={(e) => setNewCat({ ...newCat, maxEntries: e.target.value })} placeholder="ilimitado" className={inputCls} />}
            </Field>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addCategory}
              disabled={catSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {catSaving ? 'Criando...' : 'Criar categoria'}
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Pontuação ── */}
      <section aria-labelledby="setup-points" className="space-y-3">
        <h3 id="setup-points" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pontuação de ranking</h3>
        <p className="text-sm text-muted-foreground">
          Quantos pontos cada colocação vale é definido por ranking, no nível do torneio (<span className="font-medium text-foreground">{LEVEL_LABELS[tournament.level]}</span>).
          Configure em <Link href="/admin/rankings" className="font-medium text-primary underline underline-offset-2">Rankings</Link>, aba Regras de pontos.
          Quando todas as partidas terminarem, distribua os pontos na aba Chaveamento.
        </p>
        {tournament.pointsAwarded && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-warning">Os pontos já foram distribuídos. Mudar as regras não recalcula: reabra o campeonato para tirar os pontos dos rankings e distribua de novo.</p>
          </div>
        )}
      </section>
    </div>
  )
}
