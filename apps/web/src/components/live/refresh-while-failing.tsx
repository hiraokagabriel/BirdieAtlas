'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const RETRY_SECONDS = 20

/**
 * Erro numa tela que ninguém opera (telão): mostra a mensagem e recarrega o Server Component sozinho
 * a cada 20 s, até a API voltar. O botão tenta na hora.
 */
export function RefreshWhileFailing({ message }: { message: string }) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(RETRY_SECONDS)

  useEffect(() => {
    let left = RETRY_SECONDS
    const id = window.setInterval(() => {
      left -= 1
      if (left <= 0) {
        left = RETRY_SECONDS
        router.refresh()
      }
      setSeconds(left)
    }, 1000)
    return () => window.clearInterval(id)
  }, [router])

  return (
    <div className="space-y-4 text-center">
      <p role="alert" className="text-xl">{message}</p>
      <p className="text-base text-muted-foreground">Tentando de novo em {seconds} s.</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="rounded-lg border border-border px-4 py-2 text-base font-medium hover:bg-muted"
      >
        Tentar agora
      </button>
    </div>
  )
}
