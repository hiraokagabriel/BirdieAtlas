'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Save, Plus, Trash2, Check, AlertTriangle } from 'lucide-react'

type Tournament = {
  id: string; name: string; slug: string; status: string; level: string
  startDate: string; endDate: string; city: string | null; state: string | null
  location: string | null; tenantId: string; pointsTableId: string | null; pointsAwarded: boolean
}
type Category = { id: string; name: string; discipline: string; maxEntries: number | null; seedCount: number }
type PointsRow = { id?: string; placement: number; points: number }

const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const
const DISCIPLINE_LABELS: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.', MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Misto',
}
const LEVELS = ['municipal', 'regional', 'estadual', 'nacional', 'internacional']
const STATUSES = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'registration_open', label: 'Inscrições abertas' },
  { value: 'registration_closed', label: 'Inscrições encerradas' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Encerrado' },
  { value: 'cancelled', label: 'Cancelado' },
]
const DEFAULT_PLACEMENTS = [1, 2, 3, 4, 5, 6, 7, 8]
const DEFAULT_POINTS: Record<number, number> = { 1: 100, 2: 70, 3: 50, 4: 35, 5: 20, 6: 15, 7: 10, 8: 5 }

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
    status: tournament.status,
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
      status: general.status,
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

  // ── Tabela de pontos ──────────────────────────────────────────
  const [pointsRows, setPointsRows] = useState<PointsRow[]>(
    DEFAULT_PLACEMENTS.map((p) => ({ placement: p, points: DEFAULT_POINTS[p] ?? 0 }))
  )
  const [pointsLoaded, setPointsLoaded] = useState(false)
  const [pointsSaved, setPointsSaved] = useState(false)
  const [pointsTableName, setPointsTableName] = useState(`${tournament.name} - ${tournament.level}`)

  useEffect(() => {
    if (!tournament.pointsTableId || pointsLoaded) return
    apiFetch<PointsRow[]>(`/points-tables/${tournament.pointsTableId}/rows`)
      .then((rows) => {
        if (rows.length) setPointsRows(rows.map((r) => ({ id: r.id, placement: r.placement, points: r.points })))
        setPointsLoaded(true)
      })
      .catch(() => setPointsLoaded(true))
  }, [tournament.pointsTableId, pointsLoaded])

  const pointsMutation = useMutation({
    mutationFn: async () => {
      // 1. Salva tabela bulk
      const rows = await apiFetch<PointsRow[]>('/points-tables/bulk', {
        method: 'POST',
        json: {
          tenantId: tournament.tenantId,
          name: pointsTableName.trim() || `${tournament.name} - ${tournament.level}`,
          tournamentLevel: tournament.level,
          rows: pointsRows.filter((r) => r.points > 0).map((r) => ({ placement: r.placement, points: r.points })),
        },
      }) as PointsRow[]
      // 2. Vincula a primeira linha ao torneio como pointsTableId
      if (rows.length) {
        await apiFetch(`/tournaments/${tournament.id}`, {
          method: 'PUT',
          json: { pointsTableId: rows[0].id },
        })
      }
      return rows
    },
    onSuccess: () => { setPointsSaved(true); setTimeout(() => setPointsSaved(false), 2000); onRefresh() },
  })

  function updatePoints(placement: number, value: string) {
    setPointsRows((prev) => prev.map((r) => r.placement === placement ? { ...r, points: Number(value) || 0 } : r))
  }

  function addPlacement() {
    const next = Math.max(...pointsRows.map((r) => r.placement)) + 1
    setPointsRows((prev) => [...prev, { placement: next, points: 0 }])
  }

  function removePlacement(placement: number) {
    setPointsRows((prev) => prev.filter((r) => r.placement !== placement))
  }

  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

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
              <select value={general.level} onChange={(e) => setGeneral({ ...general, level: e.target.value })} className={selectCls}>
                {LEVELS.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Status</label>
            <select value={general.status} onChange={(e) => setGeneral({ ...general, status: e.target.value })} className={selectCls}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
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
          {catError && <p className="text-xs text-red-500">{catError}</p>}
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

      {/* ── Tabela de pontos ── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tabela de pontos</h3>
          <p className="text-xs text-muted-foreground mt-1">Define quantos pontos cada colocação vale neste campeonato.</p>
        </div>

        {tournament.pointsAwarded && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">Pontos já foram distribuídos. Alterar a tabela não recalcula retroativamente — use &quot;Reabrir campeonato&quot; para isso.</p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium">Nome da tabela</label>
          <input value={pointsTableName} onChange={(e) => setPointsTableName(e.target.value)} className={inputCls} />
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_auto] text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2 bg-muted/30 border-b border-border">
            <span>Colocação</span><span>Pontos</span><span />
          </div>
          {pointsRows.map((row) => (
            <div key={row.placement} className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-2 border-b border-border last:border-0">
              <span className="text-sm">{medals[row.placement] ?? `${row.placement}º`}</span>
              <input
                type="number"
                min={0}
                value={row.points}
                onChange={(e) => updatePoints(row.placement, e.target.value)}
                className="h-8 w-24 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={() => removePlacement(row.placement)} className="ml-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={addPlacement}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar colocação
          </button>
          <button
            onClick={() => pointsMutation.mutate()}
            disabled={pointsMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {pointsSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {pointsSaved ? 'Salvo!' : pointsMutation.isPending ? 'Salvando...' : 'Salvar tabela'}
          </button>
        </div>
        {pointsMutation.isError && <p className="text-xs text-red-500">Erro ao salvar tabela de pontos.</p>}
      </section>
    </div>
  )
}
