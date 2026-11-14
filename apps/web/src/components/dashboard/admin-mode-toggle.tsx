'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { useAdminMode } from '@/hooks/use-admin-mode'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// AdminModeToggle
//
// Botão flutuante no canto inferior direito.
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
        className={[
          'fixed bottom-5 right-5 z-50',
          'flex items-center gap-2 px-3 py-2 rounded-full',
          'text-xs font-semibold shadow-lg border',
          'transition-all duration-200 select-none',
          mode.isSyncing ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:scale-105 active:scale-95',
          mode.isAdmin
            ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-foreground border-foreground text-background/80 hover:text-background',
        ].join(' ')}
      >
        {mode.isAdmin ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldOff size={14} aria-hidden="true" />}
        <span>
          {mode.pinRequired
            ? mode.isAdmin ? 'Sair do modo admin' : 'Entrar como admin'
            : mode.isAdmin ? 'Admin ON' : 'Admin OFF'}
        </span>
      </button>
      {mode.error && (
        <p role="alert" className="fixed bottom-16 right-5 z-50 max-w-xs rounded-md border border-destructive bg-background px-3 py-2 text-xs font-medium text-destructive shadow-lg">
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
