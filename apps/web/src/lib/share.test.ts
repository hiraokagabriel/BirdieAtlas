import { describe, expect, it } from 'vitest'
import {
  buildShareText,
  cleanText,
  joinNames,
  rankingDisplayName,
  parseShareFormat,
  resolveSiteUrl,
  shareImageFilename,
  shareImagePath,
  truncateText,
} from './share'

describe('resolveSiteUrl', () => {
  it('uses the localhost default when missing, empty or invalid', () => {
    expect(resolveSiteUrl(undefined)).toBe('http://localhost:3000')
    expect(resolveSiteUrl('  ')).toBe('http://localhost:3000')
    expect(resolveSiteUrl('not a url')).toBe('http://localhost:3000')
    expect(resolveSiteUrl('javascript:alert(1)')).toBe('http://localhost:3000')
  })

  it('keeps the origin and drops the trailing slash', () => {
    expect(resolveSiteUrl('https://birdieatlas.example/')).toBe('https://birdieatlas.example')
    expect(resolveSiteUrl(' https://birdieatlas.example/app/ ')).toBe('https://birdieatlas.example/app')
  })
})

describe('cleanText', () => {
  it('collapses whitespace and removes control and invisible characters', () => {
    expect(cleanText('  Ana \n\t Maria  ')).toBe('Ana Maria')
    expect(cleanText('Jo​ão‮')).toBe('João')
    expect(cleanText(null)).toBe('')
    expect(cleanText(undefined)).toBe('')
  })
})

describe('truncateText', () => {
  it('returns short text untouched', () => {
    expect(truncateText('Copa Paulista', 30)).toBe('Copa Paulista')
  })

  it('cuts to the limit with an ellipsis', () => {
    const out = truncateText('Campeonato Estadual de Badminton Sub-17', 20)
    expect(Array.from(out)).toHaveLength(20)
    expect(out.endsWith('…')).toBe(true)
  })

  it('does not split emoji or accents', () => {
    expect(truncateText('🏸🏸🏸🏸🏸🏸', 4)).toBe('🏸🏸🏸…')
    expect(truncateText('Conceição Ávila Júnior', 12)).toBe('Conceição Á…')
  })

  it('cleans before measuring and handles tiny limits', () => {
    expect(truncateText('a\n\nb', 10)).toBe('a b')
    expect(truncateText('abcdef', 1)).toBe('…')
  })
})

describe('joinNames', () => {
  it('joins doubles partners and skips empty names', () => {
    expect(joinNames(['Ana', 'Bia'])).toBe('Ana / Bia')
    expect(joinNames(['Ana', null])).toBe('Ana')
    expect(joinNames([null, undefined])).toBe('')
  })
})

describe('rankingDisplayName', () => {
  it('adds the kind and year only when the name lacks them', () => {
    expect(rankingDisplayName('Simples Masculino', 2026)).toBe('Ranking Simples Masculino 2026')
    expect(rankingDisplayName('Ranking WS 2025', 2025)).toBe('Ranking WS 2025')
    expect(rankingDisplayName('Ranking Estadual', 2026)).toBe('Ranking Estadual 2026')
    expect(rankingDisplayName('Geral', 0)).toBe('Ranking Geral')
  })
})

describe('buildShareText', () => {
  it('mentions the champion of a completed tournament', () => {
    expect(buildShareText({ kind: 'tournament', name: 'Copa SP', champion: 'Ana Souza' })).toBe(
      'Copa SP: resultados e chave no BirdieAtlas. Campeão: Ana Souza.',
    )
  })

  it('has a neutral text without champion', () => {
    expect(buildShareText({ kind: 'tournament', name: 'Copa SP' })).toBe('Copa SP: chave e resultados no BirdieAtlas.')
  })

  it('covers athlete and ranking and limits long names', () => {
    expect(buildShareText({ kind: 'athlete', name: 'Ana' })).toContain('perfil')
    expect(buildShareText({ kind: 'ranking', name: 'Ranking 2026' })).toContain('classificação')
    expect(buildShareText({ kind: 'athlete', name: 'x'.repeat(300) }).length).toBeLessThan(150)
  })
})

describe('share image helpers', () => {
  it('only treats "portrait" as portrait', () => {
    expect(parseShareFormat('portrait')).toBe('portrait')
    expect(parseShareFormat('landscape')).toBe('landscape')
    expect(parseShareFormat('../etc')).toBe('landscape')
    expect(parseShareFormat(null)).toBe('landscape')
  })

  it('builds the image path with optional query', () => {
    expect(shareImagePath('/t/copa-sp')).toBe('/t/copa-sp/share-image')
    expect(shareImagePath('/t/copa-sp/', { format: 'portrait', download: '1' })).toBe(
      '/t/copa-sp/share-image?format=portrait&download=1',
    )
  })

  it('builds a safe PNG filename', () => {
    expect(shareImageFilename('Copa São Paulo 2026!')).toBe('copa-sao-paulo-2026.png')
    expect(shareImageFilename('Copa SP', 'story')).toBe('copa-sp-story.png')
    expect(shareImageFilename('???')).toBe('birdieatlas.png')
  })
})
