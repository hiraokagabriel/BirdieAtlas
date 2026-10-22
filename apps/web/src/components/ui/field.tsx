'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Atributos que o campo (input, select, textarea) precisa receber para ficar associado ao rótulo, à dica e ao erro. */
export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-required'?: true
}

interface FieldProps {
  label: ReactNode
  /** Instrução curta exibida abaixo do campo e lida junto com ele (aria-describedby). */
  hint?: ReactNode
  /** Mensagem de erro: aparece em `role="alert"` e liga o campo com `aria-invalid` + `aria-describedby`. */
  error?: string | null | undefined
  required?: boolean
  /** Rótulo menos destacado (campos opcionais). */
  muted?: boolean
  className?: string
  children: (props: FieldControlProps) => ReactNode
}

/**
 * Rótulo + campo + dica + erro, com os `id` gerados por `useId`. O campo vem como função para receber as
 * props de acessibilidade, então vale para `<input>`, `<select>`, `Input` e `SelectTrigger` do Radix.
 * Garante WCAG 1.3.1, 3.3.1, 3.3.2 e 4.1.2 em todo formulário que usar o componente.
 */
export function Field({ label, hint, error, required, muted, className, children }: FieldProps) {
  const base = useId()
  const hintId = `${base}-hint`
  const errorId = `${base}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const control: FieldControlProps = {
    id: `${base}-field`,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  }

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={control.id} className={cn('block text-xs font-medium', muted && 'text-muted-foreground')}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children(control)}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Classes dos campos de formulário escritos à mão: borda 3:1, foco sólido, erro. Prefira `Input` e `Field`. */
export const FIELD_CONTROL_CLASS =
  'w-full h-9 rounded-lg border border-field-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 disabled:opacity-60'
