// Service worker do BirdieAtlas. Objetivo: app instalável e uma página de aviso sem conexão.
// Não guarda páginas nem respostas da API (placar ao vivo e dados do admin precisam estar sempre frescos):
//  - navegação: rede; se falhar, mostra /offline;
//  - arquivos estáticos com hash (/_next/static) e ícones: cache primeiro;
//  - todo o resto (outra origem, API, POST, admin): passa direto para a rede.

const VERSION = 'v1'
const STATIC_CACHE = `birdie-static-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('birdie-') && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    )
    return
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pwa-icon/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      }),
    )
  }
})
