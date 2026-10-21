import { describe, expect, it } from 'vitest'
import { A4_LANDSCAPE_USABLE, computePrintScale } from './print'

const page = { availableWidth: 1000, availableHeight: 600 }

describe('A4_LANDSCAPE_USABLE', () => {
  it('is roughly 277 x 190 mm in CSS pixels', () => {
    expect(A4_LANDSCAPE_USABLE.width).toBe(1046)
    expect(A4_LANDSCAPE_USABLE.height).toBe(718)
  })
})

describe('computePrintScale', () => {
  it('keeps a bracket that already fits at 100%', () => {
    expect(computePrintScale({ contentWidth: 800, contentHeight: 500, ...page })).toBe(1)
  })

  it('shrinks to fit the width', () => {
    expect(computePrintScale({ contentWidth: 2000, contentHeight: 400, ...page })).toBe(0.5)
  })

  it('shrinks to fit the height when it is the limit', () => {
    expect(computePrintScale({ contentWidth: 900, contentHeight: 1000, ...page })).toBe(0.6)
  })

  it('stops at the readable minimum when the bracket is too tall and lets it flow to more pages', () => {
    expect(computePrintScale({ contentWidth: 900, contentHeight: 8000, ...page })).toBe(0.4)
  })

  it('never lets the width overflow, even below the readable minimum', () => {
    expect(computePrintScale({ contentWidth: 4000, contentHeight: 8000, ...page })).toBe(0.25)
  })

  it('ignores invalid measurements', () => {
    expect(computePrintScale({ contentWidth: 0, contentHeight: 100, ...page })).toBe(1)
    expect(computePrintScale({ contentWidth: 100, contentHeight: 100, availableWidth: 0, availableHeight: 0 })).toBe(1)
  })
})
