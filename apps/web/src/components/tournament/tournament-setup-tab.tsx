'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { TOURNAMENT_LEVELS, TOURNAMENT_LEVEL_LABELS as LEVEL_LABELS, type TournamentLevel } from '@birdie-atlas/validators'
import { scoringLabel, type CategoryDrawConfig } from '@birdie-atlas/validators'
import { apiFetch } from '@/lib/api'
import { Save, Plus, Check, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CategoryFormFields, DISCIPLINE_LABELS, DRAW_TYPE_LABELS, emptyCategoryForm, fromCategory, toCategoryBody,
  type CategoryFormErrors, type CategoryFormValue,
} from './category-form'

type Tournament = {
  id: string; name: string; slug: string; status: string; level: TournamentLevel
  startDate: string; endDate: string; city: string | null; state: string | null
  location: string | null; tenantId: string; pointsAwarded: boolean; kind?: 'official' | 'friendly'
  registrationDeadline?: string | null
}
type Category = {
  id: string; name: string; discipline: string; maxEntries: number | null; seedCount: number; drawType?: string
  pointsPerSet?: number; setPointCap?: number; setsToWin?: number; drawConfig?: CategoryDrawConfig | null
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
    kind: (tournament.kind ?? 'official') as 'official' | 'friendly',
    startDate: tournament.startDate?.slice(0, 10) ?? '',
    endDate: tournament.endDate?.slice(0, 10) ?? '',
    city: tournament.city ?? '',
    state: tournament.state ?? '',
    location: tournament.location ?? '',
    registrationDeadline: tournament.registrationDeadline?.slice(0, 10) ?? '',
  })
  const [generalSaved, setGeneralSaved] = useState(false)

  const generalMutation = useMutation({
    mutationFn: () => apiFetch(`/tournaments/${tournament.id}`, { method: 'PUT', json: {
      name: general.name.trim(),
      slug: general.slug.trim(),
      level: general.level,
      kind: general.kind,
      startDate: general.startDate || undefined,
      endDate: general.endDate || undefined,
      city: general.city.trim() || undefined,
      state: general.state.trim().toUpperCase() || undefined,
      location: general.location.trim() || undefined,
      registrationDeadline: general.registrationDeadline || null,
    }}),
    onSuccess: () => { setGeneralSaved(true); setTimeout(() => setGeneralSaved(false), 2000); onRefresh() },
  })

  // ── Categorias ────────────────────────────────────────────────
  const [newCat, setNewCat] = useState<CategoryFormValue>(emptyCategoryForm)
  const [newCatErrors, setNewCatErrors] = useState<CategoryFormErrors>({})
  const createCategory = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/tournaments/${tournament.id}/categories`, { method: 'POST', json: body }),
    onSuccess: () => { setNewCat(emptyCategoryForm()); onRefresh() },
  })
  function addCategory() {
    const parsed = toCategoryBody(newCat)
    setNewCatErrors(parsed.ok ? {} : parsed.errors)
    if (parsed.ok) createCategory.mutate(parsed.body)
  }

  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Dados gerais ── */}
      <section aria-labelledby="setup-general" className="space-y-4">
        <h3 id="setup-general" className="text-lg">Dados gerais</h3>
        <div className="grid grid-cols-1 gap-3">
          <Field
            label="Tipo"
            hint={general.kind === 'friendly' ? 'Amistoso guarda chaves, resultados e colocação, mas não pontua em rankings.' : 'Oficial pontua nos rankings quando os pontos são distribuídos.'}
          >
            {(props) => (
              <select {...props} value={general.kind} onChange={(e) => setGeneral({ ...general, kind: e.target.value as 'official' | 'friendly' })} className={selectCls}>
                <option value="official">Oficial (pontua)</option>
                <option value="friendly">Amistoso (não pontua)</option>
              </select>
            )}
          </Field>
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
          <Field label="Prazo de inscrição" muted hint="Informativo: as inscrições fecham quando o torneio muda para Inscrições encerradas.">
            {(props) => <input {...props} type="date" value={general.registrationDeadline} max={general.startDate || undefined} onChange={(e) => setGeneral({ ...general, registrationDeadline: e.target.value })} className={inputCls + ' sm:max-w-xs'} />}
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <h3 id="setup-categories" className="text-lg">Categorias</h3>

        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma categoria ainda. Adicione a primeira abaixo.</p>
        )}
        {categories.length > 0 && (
          <ul className="rounded-xl border border-border overflow-hidden">
            {categories.map((cat, i) => (
              <li key={cat.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i < categories.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      DISCIPLINE_LABELS[cat.discipline] ?? cat.discipline,
                      DRAW_TYPE_LABELS[cat.drawType ?? 'single_elimination'],
                      cat.pointsPerSet && cat.setPointCap && cat.setsToWin ? scoringLabel({ pointsPerSet: cat.pointsPerSet, setPointCap: cat.setPointCap, setsToWin: cat.setsToWin }) : null,
                      cat.maxEntries ? `máx ${cat.maxEntries}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${cat.name}`} onClick={() => setEditing(cat)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${cat.name}`} onClick={() => setDeleting(cat)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div role="group" aria-labelledby="setup-new-category" className="rounded-xl border border-border p-4 space-y-3">
          <p id="setup-new-category" className="text-sm font-semibold">Adicionar categoria</p>
          <CategoryFormFields value={newCat} onChange={setNewCat} errors={newCatErrors} />
          <div className="flex items-center justify-end gap-3">
            {createCategory.isError && <p role="alert" className="text-xs font-medium text-destructive">Não foi possível criar: {createCategory.error.message}</p>}
            <button
              type="button"
              onClick={addCategory}
              disabled={createCategory.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {createCategory.isPending ? 'Criando...' : 'Criar categoria'}
            </button>
          </div>
        </div>
        <EditCategoryDialog category={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh() }} />
        <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); onRefresh() }} />
      </section>

      <div className="border-t border-border" />

      {/* ── Pontuação ── */}
      <section aria-labelledby="setup-points" className="space-y-3">
        <h3 id="setup-points" className="text-lg">Pontuação de ranking</h3>
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

/** Edição da categoria: os mesmos campos da criação; a API recusa o que não pode mudar (formato com chave, pontuação com resultado). */
function EditCategoryDialog({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState<CategoryFormValue | null>(null)
  const [errors, setErrors] = useState<CategoryFormErrors>({})
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (category && loadedFor !== category.id) {
    setLoadedFor(category.id)
    setValue(fromCategory(category))
    setErrors({})
  }
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/tournaments/categories/${category!.id}`, { method: 'PATCH', json: body }),
    onSuccess: () => { setLoadedFor(null); onSaved() },
  })
  function close() { setLoadedFor(null); save.reset(); onClose() }
  function submit() {
    if (!value) return
    const parsed = toCategoryBody(value)
    setErrors(parsed.ok ? {} : parsed.errors)
    if (!parsed.ok) return
    // A disciplina não muda na edição (a API recusa o campo).
    const body = { ...parsed.body }
    delete body.discipline
    save.mutate(body)
  }
  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={(e) => { e.preventDefault(); submit() }} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
            <DialogDescription>{category?.name}</DialogDescription>
          </DialogHeader>
          {value && <CategoryFormFields value={value} onChange={setValue} errors={errors} disciplineLocked />}
          {save.isError && <p role="alert" className="text-sm font-medium text-destructive">{save.error.message}</p>}
          {/* Fixo no fim do diálogo: no celular o formulário rola e o botão continua à vista. */}
          <DialogFooter className="sticky bottom-0 z-10 bg-popover">
            <Button type="button" variant="outline" onClick={close} disabled={save.isPending}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar categoria'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCategoryDialog({ category, onClose, onDeleted }: { category: Category | null; onClose: () => void; onDeleted: () => void }) {
  const remove = useMutation({
    mutationFn: () => apiFetch(`/tournaments/categories/${category!.id}`, { method: 'DELETE' }),
    onSuccess: onDeleted,
  })
  function close() { remove.reset(); onClose() }
  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir categoria?</DialogTitle>
          <DialogDescription>
            {category?.name} sai do torneio. Só é possível sem chave sorteada e sem inscrições.
          </DialogDescription>
        </DialogHeader>
        {remove.isError && <p role="alert" className="text-sm font-medium text-destructive">{remove.error.message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={remove.isPending}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
