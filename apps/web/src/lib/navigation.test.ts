import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADMIN_NAV, PUBLIC_NAV, isNavItemActive } from './navigation'

const SRC_DIR = join(__dirname, '..')
const APP_DIR = join(SRC_DIR, 'app')

/** Placeholder para `${...}` em template literals: só casa com segmento dinâmico. */
const DYNAMIC = '\u0000'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** Rotas do App Router como listas de segmentos; route groups `(x)` não entram na URL. */
function collectRoutes(): string[][] {
  return walk(APP_DIR)
    .filter((file) => /[\\/]page\.tsx$/.test(file))
    .map((file) =>
      relative(APP_DIR, file)
        .split(sep)
        .slice(0, -1)
        .filter((segment) => !/^\(.+\)$/.test(segment)),
    )
}

const ROUTES = collectRoutes()

function resolves(path: string): boolean {
  const segments = path.split(/[?#]/)[0].split('/').filter(Boolean)
  return ROUTES.some(
    (route) =>
      route.length === segments.length &&
      route.every((routeSegment, i) => {
        const isDynamic = /^\[.+\]$/.test(routeSegment)
        const segment = segments[i]
        if (segment.includes(DYNAMIC)) return isDynamic && segment === DYNAMIC
        return isDynamic || routeSegment === segment
      }),
  )
}

/** Links internos literais: href="/x", href={`/x/${id}`}, href: '/x', push('/x'), redirect('/x'). */
function collectLinkLiterals(): { file: string; path: string }[] {
  const pattern = /(?:href=\{?|href:\s*|\.push\(|\.replace\(|redirect\()\s*([`'"])(\/[^`'"]*)\1/g
  return walk(SRC_DIR)
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
    .flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(pattern)].map((match) => ({
        file: relative(SRC_DIR, file),
        path: match[2].replace(/\$\{[^}]*\}/g, DYNAMIC),
      })),
    )
}

describe('navigation', () => {
  it.each([...ADMIN_NAV, ...PUBLIC_NAV].map((item) => [item.href]))('%s resolves to a page', (href) => {
    expect(resolves(href)).toBe(true)
  })

  it('every internal link literal resolves to a page', () => {
    const links = collectLinkLiterals()
    expect(links.length).toBeGreaterThan(10)
    const broken = links.filter(({ path }) => !resolves(path))
    expect(broken).toEqual([])
  })

  it('section root is active only on itself', () => {
    expect(isNavItemActive('/admin', '/admin', '/admin')).toBe(true)
    expect(isNavItemActive('/admin/athletes', '/admin', '/admin')).toBe(false)
    expect(isNavItemActive('/admin/athletes/1', '/admin/athletes', '/admin')).toBe(true)
    expect(isNavItemActive('/admin/athletes-x', '/admin/athletes', '/admin')).toBe(false)
  })
})
