'use client'

import { Button } from '@/components/ui/button'

export default function PublicError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-3xl">Não foi possível carregar esta página</h1>
      <p className="max-w-md text-muted-foreground">
        O serviço pode estar indisponível no momento. Tente novamente em instantes.
        {process.env.NODE_ENV === 'development' && error.message ? ` (${error.message})` : null}
      </p>
      <Button onClick={() => unstable_retry()}>Tentar novamente</Button>
    </div>
  )
}
