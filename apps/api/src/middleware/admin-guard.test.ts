import { describe, expect, it } from 'vitest'
import { requiresAdmin } from './admin-guard.js'

describe('requiresAdmin', () => {
  it('protects every write', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(requiresAdmin(method, '/tournaments/:id')).toBe(true)
    }
  })

  it('leaves public reads open', () => {
    expect(requiresAdmin('GET', '/tournaments')).toBe(false)
    expect(requiresAdmin('GET', '/athletes/:id/profile')).toBe(false)
    expect(requiresAdmin('OPTIONS', '/athletes')).toBe(false)
  })

  it('protects reads with personal data', () => {
    expect(requiresAdmin('GET', '/athletes')).toBe(true)
    expect(requiresAdmin('GET', '/athletes/:id')).toBe(true)
    expect(requiresAdmin('GET', '/athletes/export.csv')).toBe(true)
    expect(requiresAdmin('GET', '/registrations/tournament/:tournamentId')).toBe(true)
    expect(requiresAdmin('GET', '/tournaments/categories/:categoryId/registrations')).toBe(false)
  })

  it('protects the registrations CSV export but leaves the public ranking CSV open', () => {
    expect(requiresAdmin('GET', '/tournaments/:id/registrations/export.csv')).toBe(true)
    expect(requiresAdmin('HEAD', '/tournaments/:id/registrations/export.csv')).toBe(true)
    expect(requiresAdmin('GET', '/rankings/:rankingId/entries/export.csv')).toBe(false)
  })

  it('never guards the admin-mode toggle or unmatched routes', () => {
    expect(requiresAdmin('PATCH', '/dev/admin-mode')).toBe(false)
    expect(requiresAdmin('POST', undefined)).toBe(false)
  })
})
