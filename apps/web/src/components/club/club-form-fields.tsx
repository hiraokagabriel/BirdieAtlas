'use client'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export interface ClubFormState {
  name: string
  slug: string
  city: string
  state: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string
  coverUrl: string
}

export type ClubFormErrors = Record<string, string>

export const EMPTY_CLUB_FORM: ClubFormState = {
  name: '',
  slug: '',
  city: '',
  state: '',
  primaryColor: '#6366f1',
  secondaryColor: '#a5b4fc',
  logoUrl: '',
  coverUrl: '',
}

export function validateClubForm(form: ClubFormState): ClubFormErrors {
  const e: ClubFormErrors = {}
  if (!form.name.trim()) e.name = 'Nome é obrigatório'
  if (!form.slug.trim()) e.slug = 'Slug é obrigatório'
  else if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = 'Slug só pode ter letras minúsculas, números e hífens'
  if (form.logoUrl.trim() && !/^https?:\/\//.test(form.logoUrl)) e.logoUrl = 'URL inválida'
  if (form.coverUrl.trim() && !/^https?:\/\//.test(form.coverUrl)) e.coverUrl = 'URL inválida'
  return e
}

export function clubPayload(form: ClubFormState): Record<string, string> {
  const payload: Record<string, string> = { name: form.name.trim(), slug: form.slug.trim() }
  if (form.city.trim()) payload.city = form.city.trim()
  if (form.state.trim()) payload.state = form.state.trim().toUpperCase()
  if (form.primaryColor) payload.primaryColor = form.primaryColor
  if (form.secondaryColor) payload.secondaryColor = form.secondaryColor
  if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim()
  if (form.coverUrl.trim()) payload.coverUrl = form.coverUrl.trim()
  return payload
}

interface Props {
  form: ClubFormState
  errors: ClubFormErrors
  onChange: (next: ClubFormState) => void
  /** Só o "Novo clube" deriva o slug do nome. */
  onNameChange?: (name: string) => void
  onSlugChange?: (slug: string) => void
}

/** Campos do cadastro e da edição de clube (mesmos rótulos, erros e associação para os dois diálogos). */
export function ClubFormFields({ form, errors, onChange, onNameChange, onSlugChange }: Props) {
  return (
    <>
      <Field label="Nome do clube" required error={errors.name}>
        {(props) => (
          <Input
            {...props}
            value={form.name}
            onChange={(e) => (onNameChange ? onNameChange(e.target.value) : onChange({ ...form, name: e.target.value }))}
            placeholder="ex: Clube Peteco"
            autoComplete="off"
          />
        )}
      </Field>

      <Field label="Slug" required hint="Usado na URL pública." error={errors.slug}>
        {(props) => (
          <Input
            {...props}
            value={form.slug}
            onChange={(e) => (onSlugChange ? onSlugChange(e.target.value) : onChange({ ...form, slug: e.target.value }))}
            placeholder="ex: clube-peteco"
            className="font-mono"
            autoComplete="off"
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade (opcional)" muted>
          {(props) => (
            <Input {...props} value={form.city} onChange={(e) => onChange({ ...form, city: e.target.value })} placeholder="ex: Curitiba" />
          )}
        </Field>
        <Field label="Estado (opcional)" muted>
          {(props) => (
            <Input
              {...props}
              value={form.state}
              onChange={(e) => onChange({ ...form, state: e.target.value.toUpperCase() })}
              placeholder="ex: PR"
              maxLength={2}
              className="uppercase"
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cor primária (opcional)" muted>
          {(props) => (
            <div className="flex items-center gap-2">
              <input
                {...props}
                type="color"
                value={form.primaryColor}
                onChange={(e) => onChange({ ...form, primaryColor: e.target.value })}
                className="size-9 cursor-pointer rounded-lg border border-field-border bg-background p-1"
              />
              <span className="font-mono text-xs text-muted-foreground">{form.primaryColor}</span>
            </div>
          )}
        </Field>
        <Field label="Cor secundária (opcional)" muted>
          {(props) => (
            <div className="flex items-center gap-2">
              <input
                {...props}
                type="color"
                value={form.secondaryColor}
                onChange={(e) => onChange({ ...form, secondaryColor: e.target.value })}
                className="size-9 cursor-pointer rounded-lg border border-field-border bg-background p-1"
              />
              <span className="font-mono text-xs text-muted-foreground">{form.secondaryColor}</span>
            </div>
          )}
        </Field>
      </div>

      <Field label="URL do logo (opcional)" muted error={errors.logoUrl}>
        {(props) => (
          <Input {...props} value={form.logoUrl} onChange={(e) => onChange({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
        )}
      </Field>

      <Field label="URL da capa (opcional)" muted error={errors.coverUrl}>
        {(props) => (
          <Input {...props} value={form.coverUrl} onChange={(e) => onChange({ ...form, coverUrl: e.target.value })} placeholder="https://..." />
        )}
      </Field>
    </>
  )
}
