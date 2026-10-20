'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { TOURNAMENT_LEVELS, type TournamentLevel } from '@birdie-atlas/validators'
import { apiFetch } from '@/lib/api'
import { Save, Plus, Check, AlertTriangle } from 'lucide-react'

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
const LEVEL_LABELS: Record<TournamentLevel, string> = {
  local: 'Municipal', regional: 'Regional', state: 'Estadual', national: 'Nacional', international: 'Internacional',
}

const inputCls = 'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const selectCls = 'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer'

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
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dados gerais</h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome</label>
            <input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Slug</label>
              <input value={general.slug} onChange={(e) => setGeneral({ ...general, slug: e.target.value })} className={inputCls + ' font-mono'} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Nível</label>
              <select value={general.level} onChange={(e) => setGeneral({ ...general, level: e.target.value as TournamentLevel })} className={selectCls}>
                {TOURNAMENT_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Data início</label>
              <input type="date" value={general.startDate} onChange={(e) => setGeneral({ ...general, startDate: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Data fim</label>
              <input type="date" value={general.endDate} onChange={(e) => setGeneral({ ...general, endDate: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-1">
              <label className="text-xs font-medium">Cidade</label>
              <input value={general.city} onChange={(e) => setGeneral({ ...general, city: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Estado</label>
              <input value={general.state} maxLength={2} onChange={(e) => setGeneral({ ...general, state: e.target.value.toUpperCase() })} className={inputCls + ' uppercase'} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Local</label>
              <input value={general.location} onChange={(e) => setGeneral({ ...general, location: e.target.value })} placeholder="ex: Ginásio Central" className={inputCls} />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => generalMutation.mutate()}
            disabled={generalMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {generalSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {generalSaved ? 'Salvo!' : generalMutation.isPending ? 'Salvando...' : 'Salvar dados'}
          </button>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Categorias ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categorias</h3>

        {categories.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            {categories.map((cat, i) => (
              <div key={cat.id} className={`flex items-center justify-between px-4 py-3 ${i < categories.length - 1 ? 'border-b border-border' : ''}`}>
                <div>
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{DISCIPLINE_LABELS[cat.discipline] ?? cat.discipline}</span>
                  {cat.maxEntries && <span className="ml-2 text-xs text-muted-foreground">· máx {cat.maxEntries}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Adicionar categoria</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1">
              <label className="text-xs text-muted-foreground">Disciplina</label>
              <select value={newCat.discipline} onChange={(e) => setNewCat({ ...newCat, discipline: e.target.value as typeof DISCIPLINES[number] })} className={selectCls}>
                {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome</label>
              <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="ex: Simples Masc. A" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Máx. inscrições</label>
              <input type="number" value={newCat.maxEntries} onChange={(e) => setNewCat({ ...newCat, maxEntries: e.target.value })} placeholder="ilimitado" className={inputCls} />
            </div>
          </div>
          {catError && <p className="text-xs text-destructive">{catError}</p>}
          <div className="flex justify-end">
            <button
              onClick={addCategory}
              disabled={catSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {catSaving ? 'Criando...' : 'Criar categoria'}
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Pontuação ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pontuação de ranking</h3>
        <p className="text-sm text-muted-foreground">
          Quantos pontos cada colocação vale é definido por ranking, no nível do torneio (<span className="font-medium text-foreground">{LEVEL_LABELS[tournament.level]}</span>).
          Configure em <Link href="/admin/rankings" className="font-medium text-primary hover:underline">Rankings</Link>, aba Regras de pontos.
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
