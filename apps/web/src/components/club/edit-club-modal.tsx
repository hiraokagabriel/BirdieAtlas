'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { X, Check } from 'lucide-react'

interface ClubData {
  id: string
  name: string
  slug: string
  city: string | null
  state: string | null
  primaryColor: string | null
  secondaryColor: string | null
  logoUrl: string | null
  coverUrl: string | null
}

interface Props {
  club: ClubData
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditClubModal({ club, open, onClose, onSaved }: Props) {
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

  // Pré-preenche quando abre
  useEffect(() => {
    if (open) {
      setForm({
        name: club.name ?? '',
        slug: club.slug ?? '',
        city: club.city ?? '',
        state: club.state ?? '',
        primaryColor: club.primaryColor ?? '#6366f1',
        secondaryColor: club.secondaryColor ?? '#a5b4fc',
        logoUrl: club.logoUrl ?? '',
        coverUrl: club.coverUrl ?? '',
      })
      setErrors({})
    }
  }, [open, club])

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
      }
      if (form.city.trim()) payload.city = form.city.trim()
      if (form.state.trim()) payload.state = form.state.trim().toUpperCase()
      if (form.primaryColor) payload.primaryColor = form.primaryColor
      if (form.secondaryColor) payload.secondaryColor = form.secondaryColor
      if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim()
      if (form.coverUrl.trim()) payload.coverUrl = form.coverUrl.trim()
      return apiFetch(`/clubs/${club.id}`, { method: 'PUT', json: payload })
    },
    onSuccess: () => {
      onSaved()
      onClose()
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <h3 className="text-base font-semibold">Editar clube</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Campos com * são obrigatórios</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome do clube *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                errors.name ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Slug * <span className="text-xs text-muted-foreground font-normal">(usado na URL pública)</span></label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono ${
                errors.slug ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.slug && <p className="text-xs text-red-500">{errors.slug}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cidade</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="ex: Curitiba"
                className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                placeholder="ex: PR"
                maxLength={2}
                className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background uppercase focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cor primária</label>
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
              <label className="text-xs font-medium text-muted-foreground">Cor secundária</label>
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">URL do logo</label>
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">URL da capa</label>
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
            <p className="text-xs text-red-500">Erro ao salvar. Verifique os dados e tente novamente.</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
