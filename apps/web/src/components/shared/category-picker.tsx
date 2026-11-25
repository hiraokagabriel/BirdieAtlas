'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disciplineLabel } from '@/lib/labels'
import { matchesQuery } from '@/lib/search'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Field, FIELD_CONTROL_CLASS } from '@/components/ui/field'
import { DisciplineIcon } from '@/components/shared/discipline-icon'

export type PickerCategory = { id: string; name: string; discipline: string }

/** A partir de quantas categorias a busca e os filtros aparecem (abaixo disso, as pílulas bastam). */
const FILTER_FROM = 9
const ALL = 'all'

/** Classe da categoria: o nome sem a disciplina ("Simples Masculino Sub 17" → "Sub 17"; só a disciplina → "Geral"). */
export function categoryClass(name: string): string {
  const rest = name.replace(/^\s*(simples|duplas?|mistas?|mixed)(\s+(masculin[oa]s?|feminin[oa]s?|mistas?|mistos?))?\s*/i, '').trim()
  return rest || 'Geral'
}

interface Props {
  categories: readonly PickerCategory[]
  value: string
  onChange: (id: string) => void
  /** Conteúdo extra na pílula (ex.: total de inscritos da selecionada). */
  extra?: (cat: PickerCategory) => ReactNode
  optionClassName?: string
  className?: string
}

/**
 * Seletor de categoria do torneio: pílulas com o pictograma da disciplina e, com muitas categorias, busca pelo nome
 * e filtros de modalidade e classe (recolhidos em "Filtros"); as pílulas ficam numa linha com rolagem para não
 * empurrar a chave para fora da tela no celular. Pílulas neutras; só a selecionada em destaque.
 */
export function CategoryPicker({ categories, value, onChange, extra, optionClassName, className }: Props) {
  const [query, setQuery] = useState('')
  const [discipline, setDiscipline] = useState<string>(ALL)
  const [klass, setKlass] = useState<string>(ALL)
  const filterable = categories.length >= FILTER_FROM

  const disciplines = useMemo(() => [...new Set(categories.map((c) => c.discipline))], [categories])
  const classes = useMemo(() => [...new Set(categories.map((c) => categoryClass(c.name)))], [categories])

  const needle = query.trim()
  const filtered = categories.filter((c) =>
    (!needle || matchesQuery(c.name, needle))
    && (discipline === ALL || c.discipline === discipline)
    && (klass === ALL || categoryClass(c.name) === klass))
  const filtering = needle !== '' || discipline !== ALL || klass !== ALL
  const clear = () => { setQuery(''); setDiscipline(ALL); setKlass(ALL) }

  return (
    <div className={cn('space-y-3', className)}>
      {filtered.length === 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          Nenhuma categoria com esse filtro.
          <Button type="button" variant="outline" onClick={clear}>Limpar filtros</Button>
        </p>
      ) : (
        <ChoiceGroup
          legend="Categoria"
          hideLegend
          scroll={filterable}
          options={filtered.map((cat) => ({
            value: cat.id,
            label: cat.name,
            content: (
              <>
                <DisciplineIcon discipline={cat.discipline} />
                {cat.name}
                {extra?.(cat)}
              </>
            ),
            labelFromContent: true,
            className: 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          }))}
          value={value}
          onChange={onChange}
          optionClassName={optionClassName ?? 'px-3 text-xs font-semibold'}
        />
      )}

      {filterable && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          <div className="max-w-sm">
            <Field label="Buscar categoria">
              {(props) => (
                <input {...props} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" className={FIELD_CONTROL_CLASS} />
              )}
            </Field>
          </div>
          <details className="group space-y-3" open={discipline !== ALL || klass !== ALL}>
            <summary className="inline-flex min-h-(--control-h) cursor-pointer list-none items-center gap-1 rounded-md text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              Filtros{discipline !== ALL || klass !== ALL ? ' (ativos)' : ''}
            </summary>
          <ChoiceGroup
            legend="Modalidade"
            scroll
            options={[{ value: ALL, label: 'Todas' }, ...disciplines.map((d) => ({
              value: d,
              label: disciplineLabel(d),
              content: <><DisciplineIcon discipline={d} />{disciplineLabel(d)}</>,
              labelFromContent: true,
            }))]}
            value={discipline}
            onChange={setDiscipline}
            optionClassName="px-3 text-xs font-semibold"
          />
          {classes.length > 1 && (
            <ChoiceGroup
              legend="Classe"
              scroll
              options={[{ value: ALL, label: 'Todas' }, ...classes.map((k) => ({ value: k, label: k }))]}
              value={klass}
              onChange={setKlass}
              optionClassName="min-w-(--control-h) justify-center px-3 text-xs font-semibold"
            />
          )}
          </details>
          <p aria-live="polite" className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {filtering ? `${filtered.length} de ${categories.length} categorias` : `${categories.length} categorias`}
            {filtering && filtered.length > 0 && (
              <Button type="button" variant="ghost" onClick={clear}>Limpar filtros</Button>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
