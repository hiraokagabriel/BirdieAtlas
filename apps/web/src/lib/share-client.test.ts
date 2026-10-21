import { describe, expect, it, vi } from 'vitest'
import { shareOrCopy, shareUrlFrom, type SharePayload } from './share-client'

const payload: SharePayload = { title: 'T', text: 'x', url: 'https://site.example/t/copa' }

describe('shareOrCopy', () => {
  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    expect(await shareOrCopy({ share, clipboard: { writeText } }, payload)).toBe('shared')
    expect(share).toHaveBeenCalledWith(payload)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('does not copy when the person closes the share dialog', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }))
    const writeText = vi.fn()
    expect(await shareOrCopy({ share, clipboard: { writeText } }, payload)).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the link when there is no Web Share API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareOrCopy({ clipboard: { writeText } }, payload)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(payload.url)
  })

  it('copies when canShare refuses the payload or share fails for another reason', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const refused = { share: vi.fn(), canShare: () => false, clipboard: { writeText } }
    expect(await shareOrCopy(refused, payload)).toBe('copied')
    expect(refused.share).not.toHaveBeenCalled()

    const broken = { share: vi.fn().mockRejectedValue(new Error('NotAllowedError')), clipboard: { writeText } }
    expect(await shareOrCopy(broken, payload)).toBe('copied')
  })

  it('reports failure when copying is impossible', async () => {
    expect(await shareOrCopy({}, payload)).toBe('failed')
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    expect(await shareOrCopy({ clipboard: { writeText } }, payload)).toBe('failed')
  })
})

describe('shareUrlFrom', () => {
  it('drops the fragment and keeps path and query', () => {
    expect(shareUrlFrom('https://site.example/r/fpb-sp?x=1#topo')).toBe('https://site.example/r/fpb-sp?x=1')
  })
})
