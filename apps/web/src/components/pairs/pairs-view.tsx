'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState, useMemo } from 'react'
import type { Paginated, Pagination } from '@birdie-atlas/types'
import { apiFetch } from '@/lib/api'
import { Pager } from '@/components/shared/pager'
import { Users, Search, Plus, Pencil, PowerOff, Power } from 'lucide-react'
import { PairFormModal } from '@/components/pairs/pair-form-modal'
import { DISCIPLINE_PILL, genderAvatarClass } from '@/lib/discipline'
import { SortHeader } from '@/components/shared/sort-header'

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
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function AthleteBadge({ athlete }: { athlete: AthleteInPair }) {
  return (
    <div className="flex items-center gap-2">
      {athlete.photoUrl ? (
        <Image unoptimized src={athlete.photoUrl} alt="" width={28} height={28}
          className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <div
          aria-hidden="true"
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${genderAvatarClass(athlete.gender)}`}
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

const selectCls = 'h-9 rounded-lg border border-field-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring cursor-pointer'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function PairsView() {
  const [pairs, setPairs]           = useState<Pair[]>([])
  const [page, setPage]             = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Pair | null>(null)

  const [search, setSearch]               = useState('')
  const [disciplineFilter, setDiscipline] = useState<string>('all')
  const [activeFilter, setActive]         = useState<'all' | 'true' | 'false'>('true')
  const [sortField, setSortField]         = useState<SortField>('createdAt')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')

  const fetchPairs = useCallback(() => {
    setLoading(true)
    apiFetch<Paginated<Pair>>(`/pairs?page=${page}&pageSize=100`)
      .then((res) => { setPairs(res.data); setPagination(res.pagination) })
      .catch(() => { setPairs([]); setPagination(null) })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { fetchPairs() }, [fetchPairs])

  async function toggleActive(pair: Pair) {
    // Desativar não exclui: DELETE agora é exclusão (soft delete) e tira a dupla das listas
    await apiFetch(`/pairs/${pair.id}`, {
      method: 'PUT',
      json: { active: !pair.active },
    })
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
          <h2 className="text-2xl font-bold tracking-tight">Duplas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} ativa{activeCount !== 1 ? 's' : ''}
            {inactiveCount > 0 && ` · ${inactiveCount} inativa${inactiveCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nova dupla
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar dupla por atleta ou clube"
            placeholder="Buscar por atleta ou clube..."
            className="w-full h-9 rounded-lg border border-field-border bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select aria-label="Filtrar por disciplina" value={disciplineFilter} onChange={(e) => setDiscipline(e.target.value)} className={selectCls}>
          <option value="all">Disciplina: Todas</option>
          <option value="MD">Duplas Masc. (MD)</option>
          <option value="WD">Duplas Fem. (WD)</option>
          <option value="XD">Misto (XD)</option>
        </select>
        <select aria-label="Filtrar por situação" value={activeFilter} onChange={(e) => setActive(e.target.value as 'all' | 'true' | 'false')} className={selectCls}>
          <option value="all">Status: Todos</option>
          <option value="true">Ativas</option>
          <option value="false">Inativas</option>
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div role="status" aria-label="Carregando duplas" className="space-y-3 motion-safe:animate-pulse">
          <span className="sr-only">Carregando duplas…</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div role="status" className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30" aria-hidden="true" />
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
              type="button"
              onClick={() => { setEditing(null); setModalOpen(true) }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Nova dupla
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div tabIndex={0} role="region" aria-label="Lista de duplas" className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Duplas cadastradas. Use os botões do cabeçalho para ordenar.</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>
                  <SortHeader label="Atleta 1" active={sortField === 'athlete1'} direction={sortDir} onSort={() => toggleSort('athlete1')} />
                  <SortHeader label="Atleta 2" active={sortField === 'athlete2'} direction={sortDir} onSort={() => toggleSort('athlete2')} />
                  <SortHeader label="Disciplina" active={sortField === 'discipline'} direction={sortDir} onSort={() => toggleSort('discipline')} />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clubes</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
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
                        DISCIPLINE_PILL[pair.discipline]
                      }`}>
                        {disciplineLabel[pair.discipline]}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        pair.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
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
                          type="button"
                          onClick={() => { setEditing(pair); setModalOpen(true) }}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Editar dupla"
                          aria-label={`Editar dupla ${pair.athlete1?.name ?? ''} e ${pair.athlete2?.name ?? ''}`}
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(pair)}
                          className={`rounded-lg p-2 transition-colors hover:bg-muted ${
                            pair.active ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-success'
                          }`}
                          title={pair.active ? 'Desativar dupla' : 'Reativar dupla'}
                          aria-label={`${pair.active ? 'Desativar' : 'Reativar'} dupla ${pair.athlete1?.name ?? ''} e ${pair.athlete2?.name ?? ''}`}
                        >
                          {pair.active ? <PowerOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Power className="w-3.5 h-3.5" aria-hidden="true" />}
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

      {pagination && <Pager pagination={pagination} onPageChange={setPage} />}

      <PairFormModal
        open={modalOpen}
        pair={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={() => { setModalOpen(false); setEditing(null); fetchPairs() }}
      />
    </div>
  )
}
