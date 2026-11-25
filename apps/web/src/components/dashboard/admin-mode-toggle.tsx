'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { useAdminMode } from '@/hooks/use-admin-mode'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// AdminModeToggle
//
// Botão na barra superior do admin.
// - API sem PIN: aparece só em desenvolvimento e liga/desliga o modo admin global.
// - API com PIN (rede local): aparece sempre; "Entrar como admin" pede o PIN, e com a sessão ativa o clique sai.
// ---------------------------------------------------------------------------

export function AdminModeToggle() {
  const mode = useAdminMode()
  const [pinOpen, setPinOpen] = useState(false)

  if (mode.isLoading) return null
  if (!mode.pinRequired && process.env.NODE_ENV !== 'development') return null

  const handleClick = () => {
    if (!mode.pinRequired) mode.toggleGlobal(!mode.isAdmin)
    else if (mode.isAdmin) mode.logout()
    else setPinOpen(true)
  }

  const title = mode.pinRequired
    ? mode.isAdmin ? 'Sessão de admin ativa neste aparelho. Clique para sair.' : 'Entrar como admin com o PIN.'
    : mode.isAdmin ? 'Modo admin ligado. Clique para desligar.' : 'Modo admin desligado. Clique para ligar.'

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={mode.isSyncing}
        title={title}
        aria-pressed={mode.pinRequired ? undefined : mode.isAdmin}
        className={cn(
          // Estado do modo admin na barra superior (template admin: "Modo admin" com ✓), não flutuante.
          'inline-flex h-(--control-h) shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition-colors',
          mode.isSyncing ? 'cursor-wait opacity-60' : 'cursor-pointer',
          mode.isAdmin
            ? 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'
            : 'border-field-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {mode.isAdmin ? <ShieldCheck className="size-4" aria-hidden="true" /> : <ShieldOff className="size-4" aria-hidden="true" />}
        <span>
          {mode.pinRequired
            ? mode.isAdmin ? 'Sair do modo admin' : 'Entrar como admin'
            : 'Modo admin'}
        </span>
      </button>
      {mode.error && (
        <p role="alert" className="fixed right-4 top-16 z-50 max-w-xs rounded-md border border-destructive bg-card px-3 py-2 text-xs font-medium text-destructive shadow-raised">
          {mode.error}
        </p>
      )}
      {mode.pinRequired && <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} login={mode.login} />}
    </>
  )
}

function PinDialog({ open, onClose, login }: {
  open: boolean
  onClose: () => void
  login: ReturnType<typeof useAdminMode>['login']
}) {
  const [pin, setPin] = useState('')
  const [emptyError, setEmptyError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = () => {
    setPin('')
    setEmptyError(null)
    login.reset()
    onClose()
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!pin.trim()) {
      setEmptyError('Digite o PIN.')
      inputRef.current?.focus()
      return
    }
    setEmptyError(null)
    login.mutate(pin, { onSuccess: close })
  }

  const error = emptyError ?? (login.error ? login.error.message : null)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Entrar como admin</DialogTitle>
          <DialogDescription>A sessão vale 12 horas neste aparelho.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <Field label="PIN de admin" error={error} required>
            {(control) => (
              <Input
                {...control}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                ref={inputRef}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? 'Entrando...' : 'Entrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
