'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  THEME_LABELS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  parseThemePreference,
  readStoredThemePreference,
  resolveTheme,
  storeThemePreference,
  type ThemePreference,
} from '@/lib/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

// Sem localStorage (ou no servidor) a escolha é "sistema"; o cliente corrige após a hidratação.
const getServerSnapshot = (): ThemePreference => 'system'

function useThemePreference() {
  const preference = useSyncExternalStore(subscribe, readStoredThemePreference, getServerSnapshot)

  // Reaplica a regra quando a escolha muda (aqui ou em outra aba) e, no modo
  // "sistema", quando o SO troca de claro para escuro.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const apply = () => applyResolvedTheme(resolveTheme(preference, media.matches))
    apply()
    if (preference !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    storeThemePreference(next)
    // Se o storage falhar, o valor lido continua "sistema"; aplica direto para refletir a escolha.
    applyResolvedTheme(resolveTheme(next, window.matchMedia(DARK_QUERY).matches))
    listeners.forEach((notify) => notify())
  }, [])

  return { preference, setPreference }
}

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useThemePreference()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alterar tema" className={className}>
          {/* Ícone por CSS (variante dark) para não depender de estado no 1º render */}
          <Sun className="dark:hidden" aria-hidden="true" />
          <Moon className="hidden dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(parseThemePreference(value))}
        >
          {THEME_PREFERENCES.map((option) => {
            const Icon = ICONS[option]
            return (
              <DropdownMenuRadioItem key={option} value={option}>
                <Icon aria-hidden="true" />
                {THEME_LABELS[option]}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
