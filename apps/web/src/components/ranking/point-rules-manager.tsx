'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface PointRuleEntry {
  placement: number
  basePoints: number
}

interface PointRule {
  id: string
  rankingId: string
  tournamentLevel: TournamentLevel
  discipline: string | null
  category: string | null
  multiplier: number
  participationBonus: number
  entries: PointRuleEntry[]
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

type TournamentLevel = 'local' | 'regional' | 'state' | 'national' | 'international'
type Discipline = 'MS' | 'WS' | 'MD' | 'WD' | 'XD'

const LEVELS: { value: TournamentLevel; label: string }[] = [
  { value: 'local',         label: 'Local' },
  { value: 'regional',      label: 'Regional' },
  { value: 'state',         label: 'Estadual' },
  { value: 'national',      label: 'Nacional' },
  { value: 'international', label: 'Internacional' },
]

const DISCIPLINES: { value: Discipline; label: string }[] = [
  { value: 'MS', label: 'MS — Simples Masculino' },
  { value: 'WS', label: 'WS — Simples Feminino' },
  { value: 'MD', label: 'MD — Duplas Masculino' },
  { value: 'WD', label: 'WD — Duplas Feminino' },
  { value: 'XD', label: 'XD — Duplas Mistas' },
]

const LEVEL_COLORS: Record<TournamentLevel, string> = {
  local:         'bg-zinc-100 text-zinc-700',
  regional:      'bg-blue-100 text-blue-700',
  state:         'bg-purple-100 text-purple-700',
  national:      'bg-amber-100 text-amber-700',
  international: 'bg-emerald-100 text-emerald-700',
}

// ---------------------------------------------------------------------------
// Formulário vazio
// ---------------------------------------------------------------------------
interface RuleFormState {
  tournamentLevel: TournamentLevel
  discipline: string
  category: string
  multiplier: string
  participationBonus: string
  entries: PointRuleEntry[]
}

const emptyForm = (): RuleFormState => ({
  tournamentLevel: 'state',
  discipline: '',
  category: '',
  multiplier: '1',
  participationBonus: '0',
  entries: [
    { placement: 1, basePoints: 1000 },
    { placement: 2, basePoints: 800 },
    { placement: 3, basePoints: 600 },
    { placement: 4, basePoints: 400 },
  ],
})

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
interface PointRulesManagerProps {
  rankingId: string
}

export function PointRulesManager({ rankingId }: PointRulesManagerProps) {
  const queryClient = useQueryClient()
  const qKey = ['point-rules', rankingId]

  const { data: rules = [], isLoading } = useQuery<PointRule[]>({
    queryKey: qKey,
    queryFn: () => apiFetch(`/rankings/${rankingId}/point-rules`),
  })

  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState<RuleFormState>(emptyForm())

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qKey })

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/rankings/${rankingId}/point-rules`, { method: 'POST', json: data }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm()) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      apiFetch(`/rankings/${rankingId}/point-rules/${id}`, { method: 'PUT', json: data }),
    onSuccess: () => { invalidate(); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/rankings/${rankingId}/point-rules/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  function buildPayload(f: RuleFormState) {
    return {
      tournamentLevel:    f.tournamentLevel,
      discipline:         f.discipline || null,
      category:           f.category   || null,
      multiplier:         parseFloat(f.multiplier)         || 1,
      participationBonus: parseFloat(f.participationBonus) || 0,
      entries:            f.entries,
    }
  }

  function startEdit(rule: PointRule) {
    setEditingId(rule.id)
    setForm({
      tournamentLevel:    rule.tournamentLevel,
      discipline:         rule.discipline ?? '',
      category:           rule.category ?? '',
      multiplier:         String(rule.multiplier),
      participationBonus: String(rule.participationBonus),
      entries:            rule.entries,
    })
  }

  const grouped = LEVELS.map((lvl) => ({
    ...lvl,
    rules: rules.filter((r) => r.tournamentLevel === lvl.value),
  })).filter((g) => g.rules.length > 0 || showForm)

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando regras...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Regras de Pontos</h3>
          <p className="text-sm text-muted-foreground">
            Define quantos pontos cada colocação vale por nível de torneio.
          </p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()) }}>
          <Plus className="w-4 h-4 mr-1" /> Nova Regra
        </Button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <RuleForm
          form={form}
          setForm={setForm}
          onSave={() => createMutation.mutate(buildPayload(form))}
          onCancel={() => setShowForm(false)}
          isSaving={createMutation.isPending}
          title="Nova Regra"
        />
      )}

      {/* Estado vazio */}
      {rules.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em &quot;Nova Regra&quot; para definir a pontuação por nível de torneio.
          </p>
        </div>
      )}

      {/* Listagem agrupada por nível */}
      {grouped.map((group) => (
        <div key={group.value} className="rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 rounded-t-lg">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[group.value]}`}>
              {group.label}
            </span>
            <span className="text-xs text-muted-foreground">{group.rules.length} regra(s)</span>
          </div>

          <div className="divide-y">
            {group.rules.map((rule) => (
              <div key={rule.id} className="p-4">
                {editingId === rule.id ? (
                  <RuleForm
                    form={form}
                    setForm={setForm}
                    onSave={() => updateMutation.mutate({ id: rule.id, data: buildPayload(form) })}
                    onCancel={() => setEditingId(null)}
                    isSaving={updateMutation.isPending}
                    title="Editar Regra"
                  />
                ) : (
                  <RuleRow
                    rule={rule}
                    onEdit={() => startEdit(rule)}
                    onDelete={() => deleteMutation.mutate(rule.id)}
                    isDeleting={deleteMutation.isPending}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RuleRow
// ---------------------------------------------------------------------------
interface RuleRowProps {
  rule: PointRule
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}

function RuleRow({ rule, onEdit, onDelete, isDeleting }: RuleRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {rule.discipline && <Badge variant="outline">{rule.discipline}</Badge>}
          {rule.category   && <Badge variant="secondary">{rule.category}</Badge>}
          {rule.multiplier !== 1 && (
            <span className="text-xs text-amber-600 font-medium">×{rule.multiplier}</span>
          )}
          {rule.participationBonus > 0 && (
            <span className="text-xs text-blue-600 font-medium">+{rule.participationBonus} participação</span>
          )}
          {!rule.discipline && !rule.category && (
            <span className="text-xs text-muted-foreground italic">Aplica a todos</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete} disabled={isDeleting}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="rounded bg-muted/40 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Tabela de pontos</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {rule.entries.map((e) => (
              <div key={e.placement} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{e.placement}º lugar</span>
                <span className="font-medium">{e.basePoints} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RuleForm
// ---------------------------------------------------------------------------
interface RuleFormProps {
  form: RuleFormState
  setForm: (f: RuleFormState) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  title: string
}

function RuleForm({ form, setForm, onSave, onCancel, isSaving, title }: RuleFormProps) {
  function setEntry(i: number, field: keyof PointRuleEntry, value: string) {
    const entries = [...form.entries]
    entries[i] = { ...entries[i], [field]: Number(value) }
    setForm({ ...form, entries })
  }

  function addEntry() {
    const next = (form.entries.at(-1)?.placement ?? 0) + 1
    setForm({ ...form, entries: [...form.entries, { placement: next, basePoints: 0 }] })
  }

  function removeEntry(i: number) {
    setForm({ ...form, entries: form.entries.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-4 bg-muted/20">
      <p className="text-sm font-semibold">{title}</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Nível */}
        <div className="space-y-1">
          <label className="text-xs font-medium">Nível do Torneio *</label>
          <Select
            value={form.tournamentLevel}
            onValueChange={(v) => setForm({ ...form, tournamentLevel: v as TournamentLevel })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Disciplina */}
        <div className="space-y-1">
          <label className="text-xs font-medium">Disciplina <span className="text-muted-foreground">(opcional)</span></label>
          <Select
            value={form.discipline || '_all'}
            onValueChange={(v) => setForm({ ...form, discipline: v === '_all' ? '' : v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as disciplinas</SelectItem>
              {DISCIPLINES.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Categoria */}
        <div className="space-y-1">
          <label className="text-xs font-medium">Categoria <span className="text-muted-foreground">(opcional)</span></label>
          <Input
            className="h-8 text-xs"
            placeholder="Ex: Open, Sub-19, Sub-23"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>

        {/* Multiplicador */}
        <div className="space-y-1">
          <label className="text-xs font-medium">Multiplicador</label>
          <Input
            className="h-8 text-xs"
            type="number" step="0.1" min="0"
            value={form.multiplier}
            onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
          />
        </div>

        {/* Bônus de participação */}
        <div className="space-y-1 col-span-2">
          <label className="text-xs font-medium">
            Bônus de Participação
            <span className="text-muted-foreground ml-1">(pontos fixos independente da colocação)</span>
          </label>
          <Input
            className="h-8 text-xs"
            type="number" step="1" min="0"
            value={form.participationBonus}
            onChange={(e) => setForm({ ...form, participationBonus: e.target.value })}
          />
        </div>
      </div>

      <Separator />

      {/* Tabela de pontos por colocação */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Pontos por Colocação</p>
          <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addEntry}>
            <Plus className="w-3 h-3 mr-1" /> Colocação
          </Button>
        </div>

        <div className="space-y-1.5">
          {form.entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">{entry.placement}º lugar</span>
              <Input
                className="h-7 text-xs w-28"
                type="number" min="0"
                value={entry.basePoints}
                onChange={(e) => setEntry(i, 'basePoints', e.target.value)}
              />
              <span className="text-xs text-muted-foreground">pts base</span>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
                onClick={() => removeEntry(i)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="w-3 h-3 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          <Check className="w-3 h-3 mr-1" />
          {isSaving ? 'Salvando...' : 'Salvar Regra'}
        </Button>
      </div>
    </div>
  )
}
