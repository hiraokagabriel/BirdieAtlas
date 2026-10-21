'use client'

import { useEffect, useRef, useState } from 'react'
import { API_URL, apiFetch } from '@/lib/api'
import {
  POLL_INTERVAL_MS,
  FALLBACK_AFTER_FAILURES,
  STREAM_RETRY_FROM_POLLING_MS,
  backoffDelay,
  liveAnnouncements,
  liveReducer,
  parseLiveEvent,
  shouldFallBackToPolling,
  type LiveConnection,
  type LiveEndReason,
  type LiveEvent,
  type LiveMatch,
} from '@/lib/live'

export type LiveMatchesState = {
  matches: LiveMatch[]
  connection: LiveConnection
  /** Já chegou o primeiro snapshot (do stream ou do polling). */
  loaded: boolean
  /** Falha de carga sem dados para mostrar. */
  error: string | null
  /** Texto para a região aria-live; muda só em eventos relevantes. */
  announcement: string
}

type Options = {
  /** Chamado quando uma partida termina ou é cancelada: a página recarrega a chave. */
  onMatchEnded?: (matchId: string, reason: LiveEndReason) => void
}

const STREAM_EVENTS = ['snapshot', 'match', 'match-ended'] as const

/**
 * Partidas ao vivo de um torneio em tempo real. Usa EventSource (`GET /tournaments/:id/live`) com
 * reconexão por backoff exponencial; depois de falhas seguidas, ou sem EventSource, cai para polling
 * de `GET /tournaments/:id/live/matches` e tenta voltar ao stream de tempos em tempos.
 * Passe `null` para não conectar.
 */
export function useLiveMatches(tournamentId: string | null, options: Options = {}): LiveMatchesState {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [connection, setConnection] = useState<LiveConnection>('connecting')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const onMatchEndedRef = useRef(options.onMatchEnded)
  useEffect(() => {
    onMatchEndedRef.current = options.onMatchEnded
  })

  useEffect(() => {
    if (!tournamentId) return

    let disposed = false
    let source: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let streamRetryTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let current: LiveMatch[] = []

    setMatches([])
    setLoaded(false)
    setError(null)
    setAnnouncement('')
    setConnection('connecting')

    const apply = (event: LiveEvent) => {
      const next = liveReducer(current, event)
      const messages = liveAnnouncements(current, next)
      // O primeiro snapshot é o estado de partida, não uma novidade: só os eventos seguintes anunciam.
      if (messages.length > 0 && event.type !== 'snapshot') setAnnouncement(messages.join(' '))
      current = next
      setMatches(next)
      if (event.type === 'match-ended') onMatchEndedRef.current?.(event.matchId, event.reason)
      if (event.type === 'snapshot') {
        setLoaded(true)
        setError(null)
      }
    }

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer)
      if (streamRetryTimer) clearTimeout(streamRetryTimer)
      pollTimer = undefined
      streamRetryTimer = undefined
    }

    const poll = async () => {
      try {
        const list = await apiFetch<LiveMatch[]>(`/tournaments/${tournamentId}/live/matches`)
        if (disposed) return
        // Partidas que sumiram desde o último poll terminaram: a página recarrega a chave.
        const gone = current.filter((m) => !list.some((n) => n.matchId === m.matchId))
        apply({ type: 'snapshot', matches: list })
        for (const m of gone) onMatchEndedRef.current?.(m.matchId, 'finished')
        if (gone.length > 0) setAnnouncement(liveAnnouncements(gone, []).join(' '))
      } catch {
        if (disposed) return
        setError('Não foi possível atualizar o placar.')
      }
    }

    const startPolling = () => {
      setConnection('polling')
      void poll()
      pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS)
      // De vez em quando tenta o stream de novo; uma falha só devolve ao polling.
      streamRetryTimer = setTimeout(() => {
        stopPolling()
        failures = FALLBACK_AFTER_FAILURES - 1
        connect()
      }, STREAM_RETRY_FROM_POLLING_MS)
    }

    const connect = () => {
      if (disposed) return
      if (typeof EventSource === 'undefined') {
        startPolling()
        return
      }
      setConnection(failures > 0 ? 'reconnecting' : 'connecting')
      const es = new EventSource(`${API_URL}/tournaments/${tournamentId}/live`)
      source = es

      es.onopen = () => {
        if (!disposed) setConnection('live')
      }
      for (const name of STREAM_EVENTS) {
        es.addEventListener(name, (event) => {
          if (disposed) return
          const parsed = parseLiveEvent(name, (event as MessageEvent<string>).data)
          if (!parsed) return
          // Só um snapshot prova que o stream voltou de verdade (o servidor pode abrir e cair em seguida).
          if (parsed.type === 'snapshot') failures = 0
          apply(parsed)
        })
      }
      es.onerror = () => {
        // O navegador reconectaria sozinho, mas sem controle de espera nem fallback: fechamos e agendamos.
        es.close()
        if (disposed || source !== es) return
        source = null
        failures += 1
        if (shouldFallBackToPolling(failures)) {
          startPolling()
          return
        }
        setConnection('reconnecting')
        retryTimer = setTimeout(connect, backoffDelay(failures))
      }
    }

    connect()

    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      stopPolling()
      source?.close()
      source = null
    }
  }, [tournamentId])

  return { matches, connection, loaded, error, announcement }
}
