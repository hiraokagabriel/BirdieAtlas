'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { focusFirstInvalid } from '@/lib/focus-invalid'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  onClose: () => void
}

const GENDERS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
] as const

type Gender = (typeof GENDERS)[number]['value']

const EMPTY_FORM = { name: '', gender: 'M' as Gender, email: '', birthDate: '', nationality: 'BR' }

export function CreateAthleteModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
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

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!validate()) {
      focusFirstInvalid(ev.currentTarget)
      return
    }
    mutation.mutate()
  }

  function handleClose() {
    setForm(EMPTY_FORM)
    setErrors({})
    mutation.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo atleta</DialogTitle>
          <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <Field label="Nome completo" required error={errors.name}>
            {(props) => (
              <Input
                {...props}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: João Silva"
                autoComplete="off"
              />
            )}
          </Field>

          <ChoiceGroup
            legend="Gênero (obrigatório)"
            options={GENDERS}
            value={form.gender}
            onChange={(gender) => setForm({ ...form, gender })}
            className="space-y-1"
            optionClassName="flex-1"
          />

          <Field label="E-mail (opcional)" muted error={errors.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ex: joao@email.com"
              />
            )}
          </Field>

          <Field label="Data de nascimento (opcional)" muted>
            {(props) => (
              <Input {...props} type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            )}
          </Field>

          <Field label="Nacionalidade (opcional, padrão BR)" muted>
            {(props) => (
              <Input
                {...props}
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value.toUpperCase() })}
                placeholder="BR"
                maxLength={3}
                className="uppercase"
              />
            )}
          </Field>

          {mutation.isError && (
            <p role="alert" className="text-xs font-medium text-destructive">
              Erro ao criar atleta. Tente novamente.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <Check aria-hidden="true" />
              {mutation.isPending ? 'Criando...' : 'Criar atleta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
