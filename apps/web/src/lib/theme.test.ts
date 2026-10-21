import { describe, expect, it } from 'vitest'
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
} from './theme'

describe('parseThemePreference', () => {
  it('aceita os três valores válidos', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })

  it('cai em sistema para valor inválido ou ausente', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference(undefined)).toBe('system')
    expect(parseThemePreference('')).toBe('system')
    expect(parseThemePreference('DARK')).toBe('system')
    expect(parseThemePreference(42)).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('escolha explícita vence o sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('sistema (ou valor inválido) segue prefers-color-scheme', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme('lixo', false)).toBe('light')
  })
})

type FakeRoot = { classes: Set<string>; colorScheme: string }

function runInitScript(opts: { stored: string | null; throws?: boolean; systemDark: boolean }): FakeRoot {
  const root: FakeRoot = { classes: new Set(), colorScheme: '' }
  const documentElement = {
    classList: {
      toggle(name: string, force: boolean) {
        if (force) root.classes.add(name)
        else root.classes.delete(name)
      },
    },
    style: {
      set colorScheme(value: string) {
        root.colorScheme = value
      },
    },
  }
  const localStorage = {
    getItem(key: string) {
      if (opts.throws) throw new Error('SecurityError')
      return key === THEME_STORAGE_KEY ? opts.stored : null
    },
  }
  const matchMedia = () => ({ matches: opts.systemDark })
  new Function('localStorage', 'matchMedia', 'document', THEME_INIT_SCRIPT)(localStorage, matchMedia, {
    documentElement,
  })
  return root
}

describe('THEME_INIT_SCRIPT', () => {
  const stores = [null, 'light', 'dark', 'system', 'lixo']

  it('concorda com resolveTheme em todas as combinações', () => {
    for (const stored of stores) {
      for (const systemDark of [true, false]) {
        const expected = resolveTheme(stored, systemDark)
        const root = runInitScript({ stored, systemDark })
        expect(root.classes.has('dark'), `stored=${stored} systemDark=${systemDark}`).toBe(expected === 'dark')
        expect(root.colorScheme).toBe(expected)
      }
    }
  })

  it('segue o sistema quando o localStorage lança erro', () => {
    expect(runInitScript({ stored: null, throws: true, systemDark: true }).classes.has('dark')).toBe(true)
    expect(runInitScript({ stored: null, throws: true, systemDark: false }).classes.has('dark')).toBe(false)
  })
})
