import Image from 'next/image'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

interface AthleteAvatarProps {
  name: string
  photoUrl: string | null
  /** Lado em pixels; fixo para não causar deslocamento de layout. */
  size: number
  className?: string
}

export function AthleteAvatar({ name, photoUrl, size, className }: AthleteAvatarProps) {
  const box = { width: size, height: size }
  if (photoUrl) {
    return (
      <Image
        unoptimized
        src={photoUrl}
        alt={`Foto de ${name}`}
        width={size}
        height={size}
        style={box}
        className={cn('shrink-0 rounded-full border border-border object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size * 0.36 }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full border border-border bg-secondary font-heading font-bold text-secondary-foreground',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
