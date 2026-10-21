export const THEME_STORAGE_KEY = 'birdie-theme'

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = 'light' | 'dark'

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Sistema',
}

/** Valor desconhecido, ausente ou corrompido no storage cai em "sistema". */
export function parseThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCES.find((p) => p === value) ?? 'system'
}

/** Regra única: escolha explícita vence; "sistema" segue prefers-color-scheme. */
export function resolveTheme(stored: unknown, systemPrefersDark: boolean): ResolvedTheme {
  const preference = parseThemePreference(stored)
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/**
 * Script inline bloqueante, injetado no <head> do layout raiz para definir a
 * classe `dark` antes da primeira pintura.
 *
 * Ele DUPLICA a regra de `resolveTheme` porque precisa rodar antes de qualquer
 * módulo do bundle (um import aqui chegaria tarde demais e causaria flash).
 * `theme.test.ts` executa este texto contra `resolveTheme` para manter os dois
 * consistentes: ao mudar um, mude o outro.
 */
export const THEME_INIT_SCRIPT = `(function(){var s=null;try{s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'})()`

export function readStoredThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage indisponível (modo privado, bloqueado): a escolha vale só nesta sessão.
  }
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
