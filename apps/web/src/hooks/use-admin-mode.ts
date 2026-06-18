'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'birdie_admin_mode'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ---------------------------------------------------------------------------
// useAdminMode
//
// Gerencia o estado do modo admin de desenvolvimento.
// Persiste no localStorage para sobreviver a refresh de página.
// Sincroniza com a API via PATCH /dev/admin-mode.
//
// Uso:
//   const { isAdmin, toggle } = useAdminMode()
// ---------------------------------------------------------------------------

export function useAdminMode() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  // Lê o estado inicial do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    setIsAdmin(stored === 'true')
  }, [])

  const syncWithApi = useCallback(async (enabled: boolean) => {
    setIsSyncing(true)
    try {
      await fetch(`${API_URL}/dev/admin-mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
    } catch {
      // Falha silenciosa — API pode estar offline durante dev
      console.warn('[AdminMode] Não foi possível sincronizar com a API.')
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const enable = useCallback(async () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsAdmin(true)
    await syncWithApi(true)
  }, [syncWithApi])

  const disable = useCallback(async () => {
    localStorage.setItem(STORAGE_KEY, 'false')
    setIsAdmin(false)
    await syncWithApi(false)
  }, [syncWithApi])

  const toggle = useCallback(async () => {
    if (isAdmin) {
      await disable()
    } else {
      await enable()
    }
  }, [isAdmin, enable, disable])

  return { isAdmin, isSyncing, enable, disable, toggle }
}
