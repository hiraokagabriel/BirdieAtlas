'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
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
  const [form, setForm] = useState<ClubFormState>(EMPTY_CLUB_FORM)
  const [errors, setErrors] = useState<ClubFormErrors>({})

  // Pré-preenche quando abre
  useEffect(() => {
    if (open) {
      setForm({
        name: club.name ?? '',
        slug: club.slug ?? '',
        city: club.city ?? '',
        state: club.state ?? '',
        primaryColor: club.primaryColor ?? EMPTY_CLUB_FORM.primaryColor,
        secondaryColor: club.secondaryColor ?? EMPTY_CLUB_FORM.secondaryColor,
        logoUrl: club.logoUrl ?? '',
        coverUrl: club.coverUrl ?? '',
      })
      setErrors({})
    }
  }, [open, club])

  const mutation = useMutation({
    mutationFn: () => apiFetch(`/clubs/${club.id}`, { method: 'PUT', json: clubPayload(form) }),
    onSuccess: () => {
      onSaved()
      onClose()
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

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar clube</DialogTitle>
          <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <ClubFormFields form={form} errors={errors} onChange={setForm} />

          {mutation.isError && (
            <p role="alert" className="text-xs font-medium text-destructive">
              Erro ao salvar. Verifique os dados e tente novamente.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <Check aria-hidden="true" />
              {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
