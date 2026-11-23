import { cn } from '@/lib/utils'

/** Símbolo provisório da peteca (docs/DESIGN.md: o logo final é decisão pendente). Decorativo: o nome vem ao lado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn('size-6 shrink-0 text-primary', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 15.5 4 6.5c3-2 6.5-3 10.5-1l-1 11.5" />
      <path d="M7 4.6 11.3 16M10.6 4.2l2 12" />
      <path d="M9.5 15.5a3 3 0 0 0 4 1.5" />
      <circle cx="11.6" cy="18.6" r="2.6" />
    </svg>
  )
}
