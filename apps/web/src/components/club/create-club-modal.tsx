'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { focusFirstInvalid } from '@/lib/focus-invalid'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ClubFormFields,
  EMPTY_CLUB_FORM,
  clubPayload,
  validateClubForm,
  type ClubFormErrors,
  type ClubFormState,
} from './club-form-fields'

interface Props {
  open: boolean
  onClose: () => void
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateClubModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ClubFormState>(EMPTY_CLUB_FORM)
  const [errors, setErrors] = useState<ClubFormErrors>({})
  const [slugTouched, setSlugTouched] = useState(false)

  const mutation = useMutation({
    mutationFn: () => apiFetch('/clubs', { method: 'POST', json: clubPayload(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      handleClose()
    },
  })

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const found = validateClubForm(form)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(ev.currentTarget)
      return
    }
    mutation.mutate()
  }

  function handleClose() {
    setForm(EMPTY_CLUB_FORM)
    setErrors({})
    setSlugTouched(false)
    mutation.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo clube</DialogTitle>
          <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <ClubFormFields
            form={form}
            errors={errors}
            onChange={setForm}
            onNameChange={(name) => setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : toSlug(name) }))}
            onSlugChange={(slug) => {
              setSlugTouched(true)
              setForm((f) => ({ ...f, slug }))
            }}
          />

          {mutation.isError && (
            <p role="alert" className="text-xs font-medium text-destructive">
              Erro ao criar clube. Verifique os dados e tente novamente.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <Check aria-hidden="true" />
              {mutation.isPending ? 'Criando...' : 'Criar clube'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
