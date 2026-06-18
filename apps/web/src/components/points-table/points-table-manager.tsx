'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Plus, Trash2, Pencil, Check, X, Trophy } from 'lucide-react'

type PointsTableRow = {
  id: string
  tenantId: string
  name: string
  tournamentLevel: string
  placement: number
  points: number
}

// Agrupa linhas por (name + tournamentLevel) para exibição em blocos
function groupRows(rows: PointsTableRow[]) {
  const map = new Map<string, { name: string; level: string; rows: PointsTableRow[] }>()
  for (const row of rows) {
    const key = `${row.name}__${row.tournamentLevel}`
    if (!map.has(key)) map.set(key, { name: row.name, level: row.tournamentLevel, rows: [] })
    map.get(key)!.rows.push(row)
  }
  // Ordena linhas de cada grupo por colocação
  for (const group of map.values()) {
    group.rows.sort((a, b) => a.placement - b.placement)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// Tenant hardcoded por enquanto (sem auth)
const TENANT_ID = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_TENANT_ID ?? '')
  : ''

interface EditingRow {
  id: string | null // null = nova linha
  name: string
  tournamentLevel: string
  placement: string
  points: string
}

const emptyForm = (name = '', level = ''): EditingRow => ({
  id: null, name, tournamentLevel: level, placement: '', points: '',
})

export function PointsTableManager() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<EditingRow | null>(null)
  const [showNewGroupForm, setShowNewGroupForm] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupLevel, setNewGroupLevel] = useState('estadual')

  const { data: rows = [], isLoading } = useQuery<PointsTableRow[]>({
    queryKey: ['points-tables'],
    queryFn: () => apiFetch(`/points-tables${TENANT_ID ? `?tenantId=${TENANT_ID}` : ''}`),
  })

  const groups = groupRows(rows)

  const saveMutation = useMutation({
    mutationFn: (form: EditingRow) => {
      const payload = {
        tenantId: TENANT_ID,
        name: form.name,
        tournamentLevel: form.tournamentLevel,
        placement: Number(form.placement),
        points: Number(form.points),
      }
      if (form.id) {
        return apiFetch(`/points-tables/${form.id}`, { method: 'PUT', json: payload })
      }
      return apiFetch('/points-tables', { method: 'POST', json: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-tables'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/points-tables/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points-tables'] }),
  })

  function startEdit(row: PointsTableRow) {
    setEditing({
      id: row.id,
      name: row.name,
      tournamentLevel: row.tournamentLevel,
      placement: String(row.placement),
      points: String(row.points),
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    saveMutation.mutate(editing)
  }

  const tournamentLevels = ['municipal', 'estadual', 'regional', 'nacional', 'internacional']

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Botão nova tabela */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowNewGroupForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova tabela
        </button>
      </div>

      {/* Formulário nova tabela/grupo */}
      {showNewGroupForm && (
        <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-semibold">Nova tabela de pontos</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome da tabela</label>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="ex: Tabela Padrão FBTB"
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nível do torneio</label>
              <select
                value={newGroupLevel}
                onChange={(e) => setNewGroupLevel(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {tournamentLevels.map((l) => (
                  <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!newGroupName.trim()) return
                setEditing(emptyForm(newGroupName.trim(), newGroupLevel))
                setShowNewGroupForm(false)
                setNewGroupName('')
              }}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Continuar
            </button>
            <button
              onClick={() => setShowNewGroupForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulário de linha (nova ou edição) */}
      {editing && (
        <form onSubmit={handleSave} className="rounded-xl border border-primary/30 p-4 space-y-3 bg-primary/5">
          <p className="text-sm font-semibold">
            {editing.id ? 'Editar linha' : `Nova linha — ${editing.name} / ${editing.tournamentLevel}`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Colocação</label>
              <input
                type="number" min={1}
                value={editing.placement}
                onChange={(e) => setEditing({ ...editing, placement: e.target.value })}
                placeholder="ex: 1"
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Pontos</label>
              <input
                type="number" min={0}
                value={editing.points}
                onChange={(e) => setEditing({ ...editing, points: e.target.value })}
                placeholder="ex: 1000"
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Grupos existentes */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          Nenhuma tabela de pontos criada ainda.
        </div>
      ) : (
        groups.map((group) => (
          <div key={`${group.name}__${group.level}`} className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-sm">{group.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {group.level.charAt(0).toUpperCase() + group.level.slice(1)}
                </span>
              </div>
              <button
                onClick={() => setEditing(emptyForm(group.name, group.level))}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar linha
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Colocação</th>
                  <th className="text-left px-4 py-2 font-medium">Pontos</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {group.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-muted text-xs font-bold flex items-center justify-center">
                          {row.placement}º
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-primary">{row.points} pts</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(row)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(row.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
