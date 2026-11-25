import {
  Building2, Home, LayoutDashboard, Radio, Search, Swords, TrendingUp, Trophy, Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

// Fonte única da navegação. Todo href aqui precisa ter uma rota em src/app
// (garantido por src/lib/navigation.test.ts).
export const ADMIN_NAV: readonly NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Atletas', href: '/admin/athletes', icon: Users },
  { label: 'Duplas', href: '/admin/pairs', icon: Swords },
  { label: 'Clubes', href: '/admin/clubs', icon: Building2 },
  { label: 'Torneios', href: '/admin/tournaments', icon: Trophy },
  { label: 'Ao vivo', href: '/admin/live', icon: Radio },
  { label: 'Rankings', href: '/admin/rankings', icon: TrendingUp },
]

export const PUBLIC_NAV: readonly NavItem[] = [
  { label: 'Início', href: '/', icon: Home },
  { label: 'Ranking', href: '/#ranking', icon: TrendingUp },
  { label: 'Administração', href: '/admin', icon: LayoutDashboard },
]

/**
 * Barra inferior do portal no celular. Aponta para as seções da home, que é o ponto de partida do
 * portal: ainda não há páginas de lista de torneios, atletas ou clubes (docs/DESIGN.md, Navigation).
 */
export const PUBLIC_TAB_NAV: readonly NavItem[] = [
  { label: 'Início', href: '/', icon: Home },
  { label: 'Ao vivo', href: '/#ao-vivo', icon: Radio },
  { label: 'Ranking', href: '/#ranking', icon: TrendingUp },
  { label: 'Buscar', href: '/#busca', icon: Search },
]

/** A raiz de uma seção só fica ativa na própria página; as demais também nas subpáginas. */
export function isNavItemActive(pathname: string, href: string, rootHref: string): boolean {
  if (href === rootHref) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
