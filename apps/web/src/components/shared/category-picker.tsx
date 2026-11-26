'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disciplineLabel } from '@/lib/labels'
import { disciplineShort } from '@/lib/discipline'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { DisciplineIcon } from '@/components/shared/discipline-icon'

export type PickerCategory = { id: string; name: string; discipline: string }

/** A partir de quantas categorias o seletor vira grade Modalidade × Classe (abaixo disso, as pílulas bastam). */
const GRID_FROM = 9
const DISCIPLINE_ORDER = ['MS', 'WS', 'MD', 'WD', 'XD']

/** Classe da categoria: o nome sem a disciplina ("Simples Masculino Sub 17" → "Sub 17"; só a disciplina → "Geral"). */
export function categoryClass(name: string): string {
  const rest = name.replace(/^\s*(simples|duplas?|mistas?|mixed)(\s+(masculin[oa]s?|feminin[oa]s?|mistas?|mistos?))?\s*/i, '').trim()
  return rest || 'Geral'
}

interface Props {
  categories: readonly PickerCategory[]
  value: string
  onChange: (id: string) => void
  /** Conteúdo extra junto da categoria selecionada (ex.: total de inscritos). */
  extra?: (cat: PickerCategory) => ReactNode
  optionClassName?: string
  className?: string
}

/**
 * Seletor de categoria do torneio. Até 8 categorias: pílulas. Com mais, a categoria é Modalidade × Classe, então
 * vira um botão com a categoria atual que abre uma grade (colunas = modalidades, linhas = classes; cada célula é a
 * categoria, um radio real; fecha pelo botão ou por Esc). Categoria que não cabe na grade (nome repetido na mesma célula) vai em "Outras".
 */
export function CategoryPicker({ categories, value, onChange, extra, optionClassName, className }: Props) {
  if (categories.length < GRID_FROM) {
    return (
      <ChoiceGroup
        legend="Categoria"
        hideLegend
        className={className}
        options={categories.map((cat) => ({
          value: cat.id,
          label: cat.name,
          content: <><DisciplineIcon discipline={cat.discipline} />{cat.name}{extra?.(cat)}</>,
          labelFromContent: true,
          className: 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        }))}
        value={value}
        onChange={onChange}
        optionClassName={optionClassName ?? 'px-3 text-xs font-semibold'}
      />
    )
  }
  return <CategoryGrid categories={categories} value={value} onChange={onChange} extra={extra} className={className} />
}

function CategoryGrid({ categories, value, onChange, extra, className }: Omit<Props, 'optionClassName'>) {
  const [open, setOpen] = useState(false)
  const base = useId()
  const panelId = `${base}-panel`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const selected = categories.find((c) => c.id === value)

  const { disciplines, classes, cell, others } = useMemo(() => {
    const cell = new Map<string, PickerCategory>()
    const others: PickerCategory[] = []
    const classes: string[] = []
    for (const c of categories) {
      const k = categoryClass(c.name)
      const key = `${k}|${c.discipline}`
      if (cell.has(key)) { others.push(c); continue }
      cell.set(key, c)
      if (!classes.includes(k)) classes.push(k)
    }
    const present = new Set(categories.map((c) => c.discipline))
    const disciplines = [...DISCIPLINE_ORDER.filter((d) => present.has(d)), ...[...present].filter((d) => !DISCIPLINE_ORDER.includes(d))]
    return { disciplines, classes, cell, others }
  }, [categories])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // A grade fica aberta ao escolher: num grupo de radios as setas já trocam a seleção, e fechar a cada troca
  // impediria navegar pela grade com o teclado. Fecha pelo botão ou por Esc.
  const choose = (id: string) => onChange(id)

  // Setas ↑/↓ andam na coluna (mesma modalidade), pulando células vazias; ←/→ seguem o radio nativo (na linha).
  const vertical = (cat: PickerCategory, step: 1 | -1) => {
    const k = classes.indexOf(categoryClass(cat.name))
    for (let r = k + step; r >= 0 && r < classes.length; r += step) {
      const target = cell.get(`${classes[r]}|${cat.discipline}`)
      if (!target) continue
      choose(target.id)
      document.getElementById(`${base}-${target.id}`)?.focus()
      return
    }
  }

  const radio = (cat: PickerCategory, visible: ReactNode, boxClass: string) => (
    <label className="block">
      <input
        type="radio"
        name={`${base}-category`}
        value={cat.id}
        checked={cat.id === value}
        onChange={() => choose(cat.id)}
        id={`${base}-${cat.id}`}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          vertical(cat, e.key === 'ArrowDown' ? 1 : -1)
        }}
        aria-label={cat.name}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex min-h-(--control-h) cursor-pointer items-center justify-center rounded-md border text-xs font-semibold transition-colors',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
          cat.id === value ? 'border-primary bg-primary text-primary-foreground' : 'border-field-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          boxClass,
        )}
      >
        {visible}
      </span>
    </label>
  )

  return (
    <div className={cn('space-y-2', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-(--control-h) max-w-full items-center gap-2 rounded-md border border-field-border bg-card px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="sr-only">Categoria: </span>
        {selected && <DisciplineIcon discipline={selected.discipline} />}
        <span className="truncate">{selected?.name ?? 'Escolher categoria'}</span>
        {selected && extra?.(selected)}
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        <span className="font-normal text-muted-foreground">· {categories.length} categorias</span>
      </button>

      {open && (
        <fieldset id={panelId} className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-3">
          <legend className="sr-only">Categoria</legend>
          <div className="overflow-x-auto">
            <table className="w-fit border-separate border-spacing-1">
              <thead>
                <tr>
                  <th scope="col" className="text-left text-xs font-semibold text-muted-foreground">Classe</th>
                  {disciplines.map((d) => (
                    <th key={d} scope="col" className="min-w-11 text-xs font-semibold sm:min-w-14">
                      <span className="inline-flex flex-col items-center gap-0.5" title={disciplineLabel(d)}>
                        <DisciplineIcon discipline={d} />
                        <abbr title={disciplineLabel(d)} className="no-underline">{disciplineShort(d)}</abbr>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((k) => (
                  <tr key={k}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-left text-sm font-semibold">{k}</th>
                    {disciplines.map((d) => {
                      const cat = cell.get(`${k}|${d}`)
                      return (
                        <td key={d}>
                          {cat ? radio(cat, cat.id === value ? '●' : '', '') : <span className="block text-center text-xs text-muted-foreground" aria-hidden="true">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {others.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Outras</p>
              <div className="flex flex-wrap gap-2">
                {others.map((cat) => <div key={cat.id}>{radio(cat, cat.name, 'px-3')}</div>)}
              </div>
            </div>
          )}
        </fieldset>
      )}
    </div>
  )
}
