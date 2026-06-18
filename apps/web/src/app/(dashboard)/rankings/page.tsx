'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'
import { Plus, ChevronRight, Users, User, Zap, Trophy, Shield } from 'lucide-react'

type Ranking = {
  id: string; name: string; description: string | null
  discipline: string; year: number
  autoInclude: boolean; active: boolean
  countBestResults: number | null
  minTournamentsRequired: number
}

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? ''

const disciplineLabel: Record<string, string> = {
  MS: 'Simples Masc.', WS: 'Simples Fem.',
  MD: 'Duplas Masc.',  WD: 'Duplas Fem.', XD: 'Misto',
}
const disciplineColors: Record<string, string> = {
  MS: 'bg-blue-500/10 text-blue-700 border-blue-200',
  WS: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MD: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  WD: 'bg-pink-500/10 text-pink-700 border-pink-200',
  XD: 'bg-orange-500/10 text-orange-700 border-orange-200',
}

const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const

type CreateForm = {
  name: string
  description: string
  discipline: string
  year: number
  autoInclude: boolean
  countBestResults: string   // string para input controlado, convertido na submissão
  minTournamentsRequired: string
}

const EMPTY_FORM: CreateForm = {
  name: '', description: '', discipline: 'MS',
  year: new Date().getFullYear(), autoInclude: false,
  countBestResults: '', minTournamentsRequired: '0',
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)

  useEffect(() => {
    if (TENANT_ID) {
      apiFetch<Ranking[]>(`/rankings?tenantId=${TENANT_ID}`).then(setRankings)
    } else {
      apiFetch<Ranking[]>('/rankings').then(setRankings)
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const tenantId = TENANT_ID || ''
      const newRanking = await apiFetch<Ranking>('/rankings', {
        method: 'POST',
        json: {
          ...form,
          tenantId,
          countBestResults: form.countBestResults ? Number(form.countBestResults) : undefined,
          minTournamentsRequired: Number(form.minTournamentsRequired),
        },
      })
      setRankings((prev) => [...prev, newRanking])
      setShowCreate(false)
      setForm(EMPTY_FORM)
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
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo ranking
        </button>
      </div>

      {/* Formulário de criação */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Novo Ranking</h3>

          {/* Linha 1: Nome + Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Nome *</label>
              <input
                type="text" required placeholder="ex: Ranking Amistosos 2026"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Descrição</label>
              <input
                type="text" placeholder="Descrição opcional"
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Linha 2: Disciplina + Ano */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Disciplina *</label>
              <select
                value={form.discipline} onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                {DISCIPLINES.map((d) => <option key={d} value={d}>{disciplineLabel[d]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Ano *</label>
              <input
                type="number" min={2020} max={2099}
                value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Linha 3: Regras de contagem */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regras de contagem</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Trophy className="w-3 h-3" />
                  Melhores resultados
                </label>
                <input
                  type="number" min={1} max={99} placeholder="Todos (padrão)"
                  value={form.countBestResults}
                  onChange={(e) => setForm((f) => ({ ...f, countBestResults: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Deixe em branco para contar todos os torneios.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  Mínimo de torneios
                </label>
                <input
                  type="number" min={0} max={99}
                  value={form.minTournamentsRequired}
                  onChange={(e) => setForm((f) => ({ ...f, minTournamentsRequired: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Atletas com menos torneios são excluídos do ranking.</p>
              </div>
            </div>
          </div>

          {/* Linha 4: Auto-inclusão */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox" checked={form.autoInclude}
              onChange={(e) => setForm((f) => ({ ...f, autoInclude: e.target.checked }))}
              className="rounded"
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
              href={`/rankings/${r.id}`}
              className="group rounded-xl border border-border bg-card hover:shadow-md transition-shadow p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{r.name}</p>
                  {r.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
                  disciplineColors[r.discipline] ?? 'bg-gray-100 text-gray-700 border-gray-200'
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs">
                    <Zap className="w-3 h-3" />
                    Auto
                  </span>
                )}

                {r.countBestResults && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs">
                    <Trophy className="w-3 h-3" />
                    Top {r.countBestResults}
                  </span>
                )}

                {r.minTournamentsRequired > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 text-xs">
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
