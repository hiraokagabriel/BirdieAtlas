'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { X, Check } from 'lucide-react'

const TENANT_ID = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_TENANT_ID ?? '')
  : ''

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateClubModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    slug: '',
    city: '',
    state: '',
    primaryColor: '#6366f1',
    secondaryColor: '#a5b4fc',
    logoUrl: '',
    coverUrl: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [slugTouched, setSlugTouched] = useState(false)

  function toSlug(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: slugTouched ? f.slug : toSlug(name),
    }))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        tenantId: TENANT_ID,
      }
      if (form.city.trim()) payload.city = form.city.trim()
      if (form.state.trim()) payload.state = form.state.trim().toUpperCase()
      if (form.primaryColor) payload.primaryColor = form.primaryColor
      if (form.secondaryColor) payload.secondaryColor = form.secondaryColor
      if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim()
      if (form.coverUrl.trim()) payload.coverUrl = form.coverUrl.trim()
      return apiFetch('/clubs', { method: 'POST', json: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      handleClose()
    },
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Nome é obrigatório'
    if (!form.slug.trim()) e.slug = 'Slug é obrigatório'
    else if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = 'Slug só pode ter letras minúsculas, números e hífens'
    if (form.logoUrl.trim() && !/^https?:\/\//.test(form.logoUrl)) e.logoUrl = 'URL inválida'
    if (form.coverUrl.trim() && !/^https?:\/\//.test(form.coverUrl)) e.coverUrl = 'URL inválida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    mutation.mutate()
  }

  function handleClose() {
    setForm({ name: '', slug: '', city: '', state: '', primaryColor: '#6366f1', secondaryColor: '#a5b4fc', logoUrl: '', coverUrl: '' })
    setErrors({})
    setSlugTouched(false)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <h3 className="text-base font-semibold">Novo clube</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Campos com * são obrigatórios</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome do clube *</label>
            <input
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="ex: Clube Peteco"
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                errors.name ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Slug * <span className="text-xs text-muted-foreground font-normal">(usado na URL pública)</span></label>
            <input
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }) }}
              placeholder="ex: clube-peteco"
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono ${
                errors.slug ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.slug && <p className="text-xs text-red-500">{errors.slug}</p>}
          </div>

          {/* Cidade + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cidade <span className="text-xs">(opcional)</span></label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="ex: Curitiba"
                className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estado <span className="text-xs">(opcional)</span></label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                placeholder="ex: PR"
                maxLength={2}
                className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background uppercase focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Cores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cor primária <span className="text-xs">(opcional)</span></label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-border cursor-pointer p-1 bg-background"
                />
                <span className="text-xs text-muted-foreground font-mono">{form.primaryColor}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cor secundária <span className="text-xs">(opcional)</span></label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-border cursor-pointer p-1 bg-background"
                />
                <span className="text-xs text-muted-foreground font-mono">{form.secondaryColor}</span>
              </div>
            </div>
          </div>

          {/* Logo URL */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">URL do logo <span className="text-xs">(opcional)</span></label>
            <input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://..."
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                errors.logoUrl ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.logoUrl && <p className="text-xs text-red-500">{errors.logoUrl}</p>}
          </div>

          {/* Cover URL */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">URL da capa <span className="text-xs">(opcional)</span></label>
            <input
              value={form.coverUrl}
              onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
              placeholder="https://..."
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                errors.coverUrl ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.coverUrl && <p className="text-xs text-red-500">{errors.coverUrl}</p>}
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-500">Erro ao criar clube. Verifique os dados e tente novamente.</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {mutation.isPending ? 'Criando...' : 'Criar clube'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
