'use client'

import { useEffect } from 'react'

/** Registra o service worker (só em produção; em desenvolvimento ele atrapalharia o hot reload). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Contexto inseguro (http por IP) ou navegador sem suporte: o site funciona igual, só não instala.
    })
  }, [])
  return null
}
