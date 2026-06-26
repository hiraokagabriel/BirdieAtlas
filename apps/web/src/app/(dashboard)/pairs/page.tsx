'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import {
  Users, Search, Plus, Pencil, PowerOff, Power,
  ChevronUp, ChevronDown, ArrowUpDown, Filter,
} from 'lucide-react'
import { PairFormModal } from '@/components/pairs/pair-form-modal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AthleteInPair = {
  id: string
  name: string
  gender: 'M' | 'F'
  photoUrl: string | null
  active: boolean
  club: { id: string; name: string; logoUrl: string | null; primaryColor: string | null } | null
}

type Pair = {
  id: string
  tenantId: string
  athlete1Id: string
  athlete2Id: string
  discipline: 'MD' | 'WD' | 'XD'
  active: boolean
  createdAt: string
  updatedAt: string
  athlete1: AthleteInPair | null
  athlete2: AthleteInPair | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const disciplineLabel: Record<string, string> = {
  MD: 'Duplas Masc.', WD: 'Duplas Fem.', XD: 'Misto',
}
const disciplineColors: Record<string, string> = {
  MD: 'bg-blue-50 text-blue-700 border-blue-200',
  WD: 'bg-pink-50 text-pink-700 border-pink-200',
  XD: 'bg-orange-50 text-orange-700 border-orange-200',
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function AthleteBadge({ athlete }: { athlete: AthleteInPair }) {
  return (
    <div className="flex items-center gap-2">
      {athlete.photoUrl ? (
        <img src={athlete.photoUrl} alt={athlete.name}
          className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: athlete.gender === 'M' ? '#3b82f6' : '#ec4899' }}
        >
          {initials(athlete.name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none truncate">{athlete.name}</p>
        {athlete.club && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{athlete.club.name}</p>
        )}
      </div>
    </div>
  )
}

type SortField = 'athlete1' | 'athlete2' | 'discipline' | 'createdAt'
type SortDir = 'asc' | 'desc'

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
}

const selectCls = 'h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PairsPage() {
  const [pairs, setPairs]           = useState<Pair[]>([])
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Pair | null>(null)

  const [search, setSearch]               = useState('')
  const [disciplineFilter, setDiscipline] = useState<string>('all')
  const [activeFilter, setActive]         = useState<'all' | 'true' | 'false'>('true')
  const [sortField, setSortField]         = useState<SortField>('createdAt')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')

  function fetchPairs() {
    setLoading(true)
    apiFetch<{ data: Pair[]; total: number }>('/pairs')
      .then((res) => setPairs(res.data))
      .catch(() => setPairs([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPairs() }, [])

  async function toggleActive(pair: Pair) {
    if (pair.active) {
      await apiFetch(`/pairs/${pair.id}`, { method: 'DELETE' })
    } else {
      await apiFetch(`/pairs/${pair.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: true }),
      })
    }
    fetchPairs()
  }

  const filtered = useMemo(() => {
    return pairs
      .filter((p) => {
        const searchTerm = search.toLowerCase()
        if (searchTerm) {
          const match =
            p.athlete1?.name.toLowerCase().includes(searchTerm) ||
            p.athlete2?.name.toLowerCase().includes(searchTerm) ||
            p.athlete1?.club?.name.toLowerCase().includes(searchTerm) ||
            p.athlete2?.club?.name.toLowerCase().includes(searchTerm)
          if (!match) return false
        }
        if (disciplineFilter !== 'all' && p.discipline !== disciplineFilter) return false
        if (activeFilter !== 'all' && String(p.active) !== activeFilter) return false
        return true
      })
      .sort((a, b) => {
        let va: string
        let vb: string
        if (sortField === 'athlete1') {
          va = a.athlete1?.name ?? ''
          vb = b.athlete1?.name ?? ''
        } else if (sortField === 'athlete2') {
          va = a.athlete2?.name ?? ''
          vb = b.athlete2?.name ?? ''
        } else if (sortField === 'discipline') {
          va = a.discipline
          vb = b.discipline
        } else {
          va = a.createdAt
          vb = b.createdAt
        }
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      })
  }, [pairs, search, disciplineFilter, activeFilter, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const activeCount   = pairs.filter((p) => p.active).length
  const inactiveCount = pairs.filter((p) => !p.active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Duplas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} ativa{activeCount !== 1 ? 's' : ''}
            {inactiveCount > 0 && ` · ${inactiveCount} inativa${inactiveCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova dupla
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por atleta ou clube..."
            className="w-full h-9 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={disciplineFilter} onChange={(e) => setDiscipline(e.target.value)} className={selectCls}>
          <option value="all">Disciplina: Todas</option>
          <option value="MD">Duplas Masc. (MD)</option>
          <option value="WD">Duplas Fem. (WD)</option>
          <option value="XD">Misto (XD)</option>
        </select>
        <select value={activeFilter} onChange={(e) => setActive(e.target.value as 'all' | 'true' | 'false')} className={selectCls}>
          <option value="all">Status: Todos</option>
          <option value="true">Ativas</option>
          <option value="false">Inativas</option>
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">
            {pairs.length === 0 ? 'Nenhuma dupla cadastrada' : 'Nenhuma dupla encontrada'}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {pairs.length === 0
              ? 'Clique em "Nova dupla" para cadastrar a primeira.'
              : 'Tente ajustar os filtros aplicados.'}
          </p>
          {pairs.length === 0 && (
            <button
              onClick={() => { setEditing(null); setModalOpen(true) }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Nova dupla
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>
                  <th className="text-left px-4 py-3">
                    <button className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => toggleSort('athlete1')}>
                      Atleta 1 <SortIcon field="athlete1" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => toggleSort('athlete2')}>
                      Atleta 2 <SortIcon field="athlete2" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground" onClick={() => toggleSort('discipline')}>
                      Disciplina <SortIcon field="discipline" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clubes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((pair, i) => (
                  <tr key={pair.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{i + 1}</td>

                    {/* Atleta 1 */}
                    <td className="px-4 py-3">
                      {pair.athlete1 ? <AthleteBadge athlete={pair.athlete1} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>

                    {/* Atleta 2 */}
                    <td className="px-4 py-3">
                      {pair.athlete2 ? <AthleteBadge athlete={pair.athlete2} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>

                    {/* Disciplina */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${
                        disciplineColors[pair.discipline]
                      }`}>
                        {disciplineLabel[pair.discipline]}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        pair.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                      }`}>
                        {pair.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>

                    {/* Clubes */}
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {pair.athlete1?.club && <p>{pair.athlete1.club.name}</p>}
                        {pair.athlete2?.club && pair.athlete2.club.name !== pair.athlete1?.club?.name && (
                          <p>{pair.athlete2.club.name}</p>
                        )}
                        {!pair.athlete1?.club && !pair.athlete2?.club && <span>—</span>}
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditing(pair); setModalOpen(true) }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Editar dupla"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(pair)}
                          className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${
                            pair.active ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-green-600'
                          }`}
                          title={pair.active ? 'Desativar dupla' : 'Reativar dupla'}
                        >
                          {pair.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {filtered.length} de {pairs.length} dupla{pairs.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <PairFormModal
        open={modalOpen}
        pair={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={() => { setModalOpen(false); setEditing(null); fetchPairs() }}
      />
    </div>
  )
}
