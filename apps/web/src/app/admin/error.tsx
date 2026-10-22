'use client'

import { Button } from '@/components/ui/button'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center h-96 gap-4 text-center">
      <h2 className="text-2xl font-bold">Não foi possível carregar esta página</h2>
      <p className="max-w-md text-muted-foreground">
        Verifique se a API está no ar e tente novamente.
        {process.env.NODE_ENV === 'development' && error.message ? ` (${error.message})` : null}
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
