import { describe, expect, it } from 'vitest'
import { parseFontFaces } from './fonts'

describe('parseFontFaces', () => {
  it('maps each weight to its ttf url', () => {
    const css = `
@font-face {
  font-family: 'Barlow Condensed';
  font-style: normal;
  font-weight: 500;
  src: url(https://fonts.gstatic.com/s/barlowcondensed/v13/aaa.ttf) format('truetype');
}
@font-face {
  font-family: 'Barlow Condensed';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/barlowcondensed/v13/bbb.ttf) format('truetype');
}`
    expect([...parseFontFaces(css)]).toEqual([
      [500, 'https://fonts.gstatic.com/s/barlowcondensed/v13/aaa.ttf'],
      [700, 'https://fonts.gstatic.com/s/barlowcondensed/v13/bbb.ttf'],
    ])
  })

  it('ignores non-ttf sources and foreign hosts', () => {
    const css = `@font-face { font-weight: 700; src: url(https://evil.example/x.ttf) format('truetype'); }
@font-face { font-weight: 500; src: url(https://fonts.gstatic.com/x.woff2) format('woff2'); }`
    expect(parseFontFaces(css).size).toBe(0)
    expect(parseFontFaces('').size).toBe(0)
  })
})
