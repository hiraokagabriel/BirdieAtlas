'use client'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          // Fallback: mutations sem onError próprio ainda mostram a mensagem da API.
          onError: (error, _variables, _context, mutation) => {
            if (mutation.options.onError) return
            toast({ variant: 'destructive', title: 'Erro', description: error.message })
          },
        }),
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
