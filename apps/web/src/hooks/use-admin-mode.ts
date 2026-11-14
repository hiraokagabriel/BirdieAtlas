'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { setAdminToken } from '@/lib/admin-token'

// ---------------------------------------------------------------------------
// useAdminMode
//
// Estado do acesso admin, sempre lido da API (GET /admin/session):
// - Sem PIN na API: modo global de desenvolvimento, alternado por PATCH /dev/admin-mode.
// - Com PIN (rede local): entrar troca o PIN por um token guardado neste navegador; sair o revoga.
// Toda troca invalida as queries, para as telas recarregarem com a nova permissão.
// ---------------------------------------------------------------------------

interface AdminSessionState {
  pinRequired: boolean
  admin: boolean
}

export function useAdminMode() {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: ['admin-session'],
    queryFn: () => apiFetch<AdminSessionState>('/admin/session'),
    staleTime: 30_000,
  })
  const refreshAll = () => queryClient.invalidateQueries()
  // Ao perder o acesso, apaga o cache: dados pessoais já carregados não podem seguir na tela.
  const dropCachedData = () => {
    void queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== 'admin-session' })
    void queryClient.invalidateQueries({ queryKey: ['admin-session'] })
  }

  const toggleGlobal = useMutation({
    mutationFn: (enabled: boolean) => apiFetch('/dev/admin-mode', { method: 'PATCH', json: { enabled } }),
    onSettled: (_data, _error, enabled) => (enabled ? void refreshAll() : dropCachedData()),
  })

  const login = useMutation({
    mutationFn: (pin: string) => apiFetch<{ token: string }>('/admin/session', { method: 'POST', json: { pin } }),
    onSuccess: ({ token }) => {
      setAdminToken(token)
      void refreshAll()
    },
  })

  // O DELETE leva o token; só depois ele sai do navegador, mesmo se a API não responder.
  const logout = useMutation({
    mutationFn: () => apiFetch('/admin/session', { method: 'DELETE' }),
    onSettled: () => {
      setAdminToken(null)
      dropCachedData()
    },
  })

  return {
    isLoading: session.isPending,
    pinRequired: session.data?.pinRequired ?? false,
    isAdmin: session.data?.admin ?? false,
    isSyncing: toggleGlobal.isPending || login.isPending || logout.isPending,
    toggleGlobal: (enabled: boolean) => toggleGlobal.mutate(enabled),
    login,
    logout: () => logout.mutate(),
  }
}
