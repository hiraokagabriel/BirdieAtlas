import { describe, expect, it } from 'vitest'
import { downloadErrorMessage, filenameFromDisposition } from './download-helpers'

describe('filenameFromDisposition', () => {
  it('prefers filename* and decodes it', () => {
    expect(
      filenameFromDisposition(`attachment; filename="x.csv"; filename*=UTF-8''copa%20s%C3%A3o-inscritos.csv`, 'f.csv'),
    ).toBe('copa são-inscritos.csv')
  })

  it('falls back to the plain filename, then to the fallback', () => {
    expect(filenameFromDisposition('attachment; filename="ranking.csv"', 'f.csv')).toBe('ranking.csv')
    expect(filenameFromDisposition('attachment', 'f.csv')).toBe('f.csv')
    expect(filenameFromDisposition(null, 'f.csv')).toBe('f.csv')
  })

  it('never returns path separators', () => {
    expect(filenameFromDisposition(`attachment; filename*=UTF-8''..%2F..%2Fevil.csv`, 'f.csv')).toBe('.._.._evil.csv')
  })
})

describe('downloadErrorMessage', () => {
  it('uses the API error contract', async () => {
    const res = new Response(JSON.stringify({ error: 'Acesso negado', code: 'ADMIN_MODE_DISABLED' }), { status: 403 })
    expect(await downloadErrorMessage(res)).toBe('Acesso negado')
  })

  it('has a generic message for non-JSON bodies', async () => {
    expect(await downloadErrorMessage(new Response('<html>', { status: 502 }))).toBe(
      'Não foi possível baixar o arquivo (erro 502).',
    )
  })
})
