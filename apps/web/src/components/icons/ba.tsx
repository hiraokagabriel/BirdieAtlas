import type { SVGProps } from 'react'
import { cn } from '../../lib/utils'

// Ícones de domínio do BA, duotone: traço de 1,75 px em `currentColor` (pontas arredondadas) e uma camada cheia
// translúcida (20 %) na mesma cor. Grade 24×24, área útil de 2 a 22. Os nomes repetem os do Lucide que substituem,
// para a troca ser só no `import`; os genéricos (setas, X, check, editar, lixeira, carregando) seguem no Lucide.
// Ver docs/DESIGN.md, Iconografia.

export type BaIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number | string; strokeWidth?: number | string }

const TINT = 0.2

function make(displayName: string, tint: React.ReactNode, line: React.ReactNode) {
  function Icon({ size = 24, strokeWidth = 1.75, className, ...rest }: BaIconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn('ba-icon shrink-0', className)}
        {...rest}
      >
        <g fill="currentColor" fillOpacity={TINT} stroke="none">{tint}</g>
        {line}
      </svg>
    )
  }
  Icon.displayName = displayName
  return Icon
}

/** Início: casa com a rede de badminton na porta. */
export const Home = make('Home',
  <path d="M4 10.5 12 4l8 6.5V20H4z" />,
  <>
    <path d="M3 11 12 3.5 21 11" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M9 20v-6h6v6" />
    <path d="M9 16h6M12 14v6" strokeWidth={1} />
  </>)

/** Painel do admin: placar com quatro quadrantes. */
export const LayoutDashboard = make('LayoutDashboard',
  <><rect x="3.5" y="3.5" width="7" height="9" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /></>,
  <>
    <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
    <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
  </>)

/** Atleta: jogador com raquete. */
export const User = make('User',
  <circle cx="9" cy="6" r="3" />,
  <>
    <circle cx="9" cy="6" r="3" />
    <path d="M3.5 21v-2.5A5.5 5.5 0 0 1 9 13a5.5 5.5 0 0 1 5.5 5.5V21" />
    <path d="M14.5 12.5 18 9" />
    <ellipse cx="19.6" cy="6.6" rx="1.9" ry="2.6" transform="rotate(40 19.6 6.6)" />
  </>)

/** Atletas: dois jogadores, o de trás atenuado. */
export const Users = make('Users',
  <><circle cx="9" cy="7" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2z" /></>,
  <>
    <circle cx="9" cy="7" r="3" />
    <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
    <path d="M15.5 4.3a3 3 0 0 1 0 5.4" opacity={0.6} />
    <path d="M17.5 14a5.5 5.5 0 0 1 3.5 5v2" opacity={0.6} />
  </>)

/** Duplas: duas raquetes cruzadas e a peteca. */
export const Swords = make('Swords',
  <><ellipse cx="7" cy="7" rx="3.2" ry="4.2" transform="rotate(-45 7 7)" /><ellipse cx="17" cy="7" rx="3.2" ry="4.2" transform="rotate(45 17 7)" /></>,
  <>
    <ellipse cx="7" cy="7" rx="3.2" ry="4.2" transform="rotate(-45 7 7)" />
    <ellipse cx="17" cy="7" rx="3.2" ry="4.2" transform="rotate(45 17 7)" />
    <path d="M9.5 9.5 19 19M14.5 9.5 5 19" />
    <path d="M17.5 20.5 20.5 17.5M3.5 17.5l3 3" />
  </>)

/** Clube: escudo com a peteca. */
export const Building2 = make('Building2',
  <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />,
  <>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
    <path d="M10 15.5h4l1.2-6h-6.4z" />
    <path d="M11 9.5 10.5 7M13 9.5l.5-2.5M12 9.5V7" strokeWidth={1.25} />
  </>)
export const Shield = Building2

/** Torneio: troféu com a peteca no topo. */
export const Trophy = make('Trophy',
  <path d="M7 4h10v5a5 5 0 0 1-10 0z" />,
  <>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1A3.5 3.5 0 0 1 16 10.5" />
    <path d="M12 14v3.5M8.5 21h7M9.5 21l.5-3.5h4l.5 3.5" />
  </>)

/** Ao vivo: peteca de pé com as ondas de transmissão. */
export const Radio = make('Radio',
  <path d="M9.5 5h5l-1 8h-3z" />,
  <>
    <path d="M9.5 5h5l-1 8h-3z" />
    <path d="M10.5 13h3v1.5a1.5 1.5 0 0 1-3 0z" />
    <path d="M6.2 6.5a7 7 0 0 0 0 8.5M17.8 6.5a7 7 0 0 1 0 8.5" />
    <path d="M3.5 4.5a10.5 10.5 0 0 0 0 12.5M20.5 4.5a10.5 10.5 0 0 1 0 12.5" opacity={0.6} />
  </>)

/** Ranking: pódio. */
export const TrendingUp = make('TrendingUp',
  <path d="M9 9h6v12H9z" />,
  <>
    <path d="M9 9h6v12H9zM3 13h6v8H3zM15 15h6v6h-6z" />
    <path d="m12 3 .9 1.8 2 .3-1.45 1.4.35 2L12 7.6l-1.8.9.35-2L9.1 5.1l2-.3z" strokeWidth={1.25} />
  </>)

/** Local: alfinete com a quadra. */
export const MapPin = make('MapPin',
  <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />,
  <>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <rect x="9" y="6.5" width="6" height="6" rx="0.5" strokeWidth={1.25} />
    <path d="M9 9.5h6" strokeWidth={1.25} />
  </>)

/** Agenda. */
export const Calendar = make('Calendar',
  <path d="M3.5 6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V10h-17z" />,
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 2.5v4M16 2.5v4" />
    <path d="M8 14h2M14 14h2M8 17.5h2" />
  </>)

/** Partida agendada: agenda com relógio. */
export const CalendarClock = make('CalendarClock',
  <circle cx="16.5" cy="16.5" r="4.5" />,
  <>
    <path d="M20.5 10V6.5a2 2 0 0 0-2-2h-13a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H11" />
    <path d="M3.5 10h17M8 2.5v4M16 2.5v4" />
    <circle cx="16.5" cy="16.5" r="4.5" />
    <path d="M16.5 14.5v2l1.4 1" />
  </>)

/** Torneio encerrado / presença confirmada: agenda com check. */
export const CalendarCheck = make('CalendarCheck',
  <path d="M3.5 6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V10h-17z" />,
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 2.5v4M16 2.5v4" />
    <path d="m9 15 2 2 4-4" />
  </>)

/** Campeão / destaque: medalha. */
export const Star = make('Star',
  <circle cx="12" cy="15" r="5" />,
  <>
    <path d="M8 3h3l1 5M16 3h-3l-1 5" />
    <circle cx="12" cy="15" r="5" />
    <path d="M12 12.5v5M10.8 13.5 12 12.5" strokeWidth={1.5} />
  </>)

/** Chave (chaveamento): colchetes de eliminatória. */
export const Shuffle = make('Shuffle',
  <path d="M15 8h3.5v8H15z" />,
  <>
    <path d="M3 5h5v6H3M3 13h5v6H3" />
    <path d="M8 8h3.5v8H8M11.5 12H15" />
    <path d="M15 8h3.5v8H15M18.5 12H21" />
  </>)

/** Peteca, para uso decorativo (estados vazios, marca). */
export const Shuttlecock = make('Shuttlecock',
  <path d="M7 4h10l-2.5 11h-5z" />,
  <>
    <path d="M7 4h10l-2.5 11h-5z" />
    <path d="M10 4l.5 11M14 4l-.5 11" strokeWidth={1.25} />
    <path d="M9.5 15h5v1.5a2.5 2.5 0 0 1-5 0z" />
  </>)
