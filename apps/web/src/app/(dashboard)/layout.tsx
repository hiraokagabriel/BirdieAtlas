'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  Trophy,
  TrendingUp,
  Feather,
  ChevronRight,
  Bell,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Atletas', href: '/athletes', icon: Users },
  { label: 'Clubes', href: '/clubs', icon: Building2 },
  { label: 'Torneios', href: '/tournaments', icon: Trophy },
  { label: 'Rankings', href: '/rankings', icon: TrendingUp },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border bg-sidebar shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
            <Feather className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">BirdieAtlas</p>
            <p className="text-xs text-muted-foreground mt-0.5">Fed. Paulista</p>
          </div>
        </div>

        <Separator />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        <Separator />

        {/* User */}
        <div className="px-3 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">AD</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium leading-none">Admin</p>
                  <p className="text-xs text-muted-foreground mt-0.5">admin@fpb.com.br</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuItem><Settings className="w-4 h-4 mr-2" />Configurações</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive"><LogOut className="w-4 h-4 mr-2" />Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-border shrink-0">
          <div>
            <h1 className="text-xl font-semibold">Campeonato Paulista de Badminton 2026</h1>
            <p className="text-sm text-muted-foreground">Federação Paulista de Badminton</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default" className="bg-green-500 hover:bg-green-500 text-white">Em andamento</Badge>
            <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
