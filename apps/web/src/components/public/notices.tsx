import type { ReactNode } from 'react'

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {children}
    </p>
  )
}

export function EmptyNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
