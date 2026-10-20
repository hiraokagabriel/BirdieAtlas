'use client'

import { ShieldCheck, ShieldOff } from 'lucide-react'
import { useAdminMode } from '@/hooks/use-admin-mode'

// ---------------------------------------------------------------------------
// AdminModeToggle
//
// Botão flutuante visível APENAS em desenvolvimento (NODE_ENV=development).
// Posicionado no canto inferior direito da tela.
// Verde com escudo = modo admin LIGADO (pode usar rotas protegidas).
// Cinza com cadeado = modo admin DESLIGADO.
//
// Como usar: adicione <AdminModeToggle /> no layout do dashboard.
// ---------------------------------------------------------------------------

export function AdminModeToggle() {
  // Não renderiza nada em produção
  if (process.env.NODE_ENV !== 'development') return null

  return <AdminModeToggleInner />
}

function AdminModeToggleInner() {
  const { isAdmin, isSyncing, toggle } = useAdminMode()

  return (
    <button
      onClick={toggle}
      disabled={isSyncing}
      title={isAdmin ? 'Modo Admin LIGADO — clique para desligar' : 'Modo Admin DESLIGADO — clique para ligar'}
      className={[
        'fixed bottom-5 right-5 z-50',
        'flex items-center gap-2 px-3 py-2 rounded-full',
        'text-xs font-semibold shadow-lg border',
        'transition-all duration-200 select-none',
        isSyncing ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:scale-105 active:scale-95',
        isAdmin
          ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-foreground border-foreground text-background/80 hover:text-background',
      ].join(' ')}
    >
      {isAdmin ? (
        <>
          <ShieldCheck size={14} />
          <span>Admin ON</span>
        </>
      ) : (
        <>
          <ShieldOff size={14} />
          <span>Admin OFF</span>
        </>
      )}
    </button>
  )
}
