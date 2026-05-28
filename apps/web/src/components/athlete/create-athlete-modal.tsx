'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { X, Check } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

const GENDERS = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }]

export function CreateAthleteModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '', gender: 'M', email: '', birthDate: '', nationality: 'BR',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {
        name: form.name.trim(),
        gender: form.gender,
        nationality: form.nationality || 'BR',
      }
      if (form.email.trim()) payload.email = form.email.trim()
      if (form.birthDate) payload.birthDate = form.birthDate
      return apiFetch('/athletes', { method: 'POST', json: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] })
      handleClose()
    },
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Nome é obrigatório'
    if (form.email.trim() && !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = 'E-mail inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    mutation.mutate()
  }

  function handleClose() {
    setForm({ name: '', gender: 'M', email: '', birthDate: '', nationality: 'BR' })
    setErrors({})
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold">Novo atleta</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Campos com * são obrigatórios</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome completo *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: João Silva"
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                errors.name ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Gênero */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Gênero *</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setForm({ ...form, gender: g.value })}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    form.gender === g.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email (opcional) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">E-mail <span className="text-xs">(opcional)</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ex: joao@email.com"
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                errors.email ? 'border-red-400' : 'border-border'
              }`}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Data de nascimento (opcional) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data de nascimento <span className="text-xs">(opcional)</span></label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Nacionalidade (opcional) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nacionalidade <span className="text-xs">(opcional, padrão BR)</span></label>
            <input
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value.toUpperCase() })}
              placeholder="BR"
              maxLength={3}
              className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring uppercase"
            />
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-500">Erro ao criar atleta. Tente novamente.</p>
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
              {mutation.isPending ? 'Criando...' : 'Criar atleta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
