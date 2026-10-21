import { describe, expect, it } from 'vitest'
import { formatSseComment, formatSseMessage, SSE_HEADERS } from './sse.js'

describe('formatSseMessage', () => {
  it('monta id, evento e dado em JSON terminando com linha em branco', () => {
    expect(formatSseMessage({ event: 'match', id: 7, data: { a: 1 } })).toBe('id: 7\nevent: match\ndata: {"a":1}\n\n')
  })

  it('omite campos ausentes e aceita retry', () => {
    expect(formatSseMessage({ data: 'oi', retry: 3000.9 })).toBe('retry: 3000\ndata: "oi"\n\n')
  })

  it('nunca deixa quebra de linha vazar para o frame', () => {
    const frame = formatSseMessage({ event: 'x\nevil: 1', data: { text: 'a\nb\r\nc' } })
    expect(frame).toBe('event: x evil: 1\ndata: {"text":"a\\nb\\r\\nc"}\n\n')
    expect(frame.split('\n\n')).toHaveLength(2)
  })
})

describe('formatSseComment', () => {
  it('gera comentário de heartbeat', () => {
    expect(formatSseComment('heartbeat')).toBe(': heartbeat\n\n')
    expect(formatSseComment('a\nb')).toBe(': a b\n\n')
  })
})

describe('SSE_HEADERS', () => {
  it('desliga cache e buffering', () => {
    expect(SSE_HEADERS['Content-Type']).toContain('text/event-stream')
    expect(SSE_HEADERS['Cache-Control']).toContain('no-cache')
    expect(SSE_HEADERS['X-Accel-Buffering']).toBe('no')
  })
})
