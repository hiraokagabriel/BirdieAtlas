import { describe, expect, it, vi } from 'vitest'
import { LiveBus, type LiveEvent } from './live-bus.js'

const ended: LiveEvent<string> = { type: 'match-ended', matchId: 'm1', reason: 'finished' }

describe('LiveBus', () => {
  it('entrega só aos assinantes do torneio', () => {
    const bus = new LiveBus<string>()
    const a = vi.fn()
    const b = vi.fn()
    bus.subscribe('t1', a)
    bus.subscribe('t2', b)
    bus.publish('t1', { type: 'match', match: 'x' })
    expect(a).toHaveBeenCalledWith({ type: 'match', match: 'x' })
    expect(b).not.toHaveBeenCalled()
  })

  it('cancelar a assinatura para a entrega e libera o ouvinte', () => {
    const bus = new LiveBus<string>()
    const a = vi.fn()
    const off = bus.subscribe('t1', a)
    expect(bus.listenerCount('t1')).toBe(1)
    off()
    bus.publish('t1', ended)
    expect(a).not.toHaveBeenCalled()
    expect(bus.listenerCount('t1')).toBe(0)
  })

  it('ouvinte que lança não impede os demais nem quem publica', () => {
    const bus = new LiveBus<string>()
    const ok = vi.fn()
    bus.subscribe('t1', () => {
      throw new Error('socket fechado')
    })
    bus.subscribe('t1', ok)
    expect(() => bus.publish('t1', ended)).not.toThrow()
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('aceita muitas conexões sem estourar o limite de ouvintes', () => {
    const bus = new LiveBus<string>()
    for (let i = 0; i < 50; i++) bus.subscribe('t1', () => undefined)
    expect(bus.listenerCount('t1')).toBe(50)
  })
})
