'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ChoiceOption<T extends string> {
  value: T
  /** Texto lido por leitores de tela (e exibido, se `content` não vier). */
  label: string
  content?: ReactNode
  /** Com `content`, o nome acessível é o `label`; com isto, o nome vem do próprio conteúdo (título + descrição). */
  labelFromContent?: boolean
  /** Classes quando não selecionado e quando selecionado (padrão: segmento verde). */
  className?: string
  activeClassName?: string
}

interface ChoiceGroupProps<T extends string> {
  legend: string
  /** Esconde a legenda visualmente; leitores de tela continuam a ler. */
  hideLegend?: boolean
  options: readonly ChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
  /** Classes de cada opção (tamanho, raio, tipografia). */
  optionClassName?: string
}

const IDLE = 'border-border bg-background text-foreground hover:bg-muted'
const ACTIVE = 'border-primary bg-primary text-primary-foreground'

/**
 * Escolha exclusiva (gênero, disciplina, categoria, tipo de resultado): grupo de `<input type="radio">` reais
 * dentro de `fieldset`/`legend`. O estado selecionado é exposto por `checked` (não só pela cor), e as setas
 * do teclado movem a seleção como em qualquer grupo de rádio nativo (WCAG 1.3.1, 2.1.1, 4.1.2).
 */
export function ChoiceGroup<T extends string>({
  legend,
  hideLegend,
  options,
  value,
  onChange,
  disabled,
  className,
  optionClassName,
}: ChoiceGroupProps<T>) {
  const name = useId()
  return (
    <fieldset className={cn('min-w-0', className)} disabled={disabled}>
      <legend className={cn('mb-1 text-xs font-medium', hideLegend && 'sr-only')}>{legend}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:opacity-60',
                optionClassName,
                checked ? (option.activeClassName ?? ACTIVE) : (option.className ?? IDLE),
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
                {...(option.content && !option.labelFromContent ? { 'aria-label': option.label } : {})}
              />
              {option.content ?? option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
