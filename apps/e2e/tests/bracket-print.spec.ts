import { expect, test } from '@playwright/test'
import { prepareTournament, uniqueTag } from '../support/factories.js'

// Impressão da chave: o cabeçalho do torneio e a chave saem na mesma página A4 paisagem, sem página em branco
// antes ou depois (antes, a página nomeada só no bloco da chave forçava quebras ao redor dele).

function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

test('chave pequena imprime numa página só, com o cabeçalho', async ({ page }) => {
  const prepared = await prepareTournament({ athleteCount: 8, name: `Impressão ${uniqueTag()}` })
  await page.goto(`/t/${prepared.tournament.slug}`)
  await expect(page.getByRole('region', { name: /^Chave de/ })).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  expect(pageCount(pdf)).toBe(1)
})

test('chave de 64 não deixa a primeira página só com o cabeçalho', async ({ page }) => {
  const prepared = await prepareTournament({ athleteCount: 40, name: `Impressão grande ${uniqueTag()}` })
  await page.goto(`/t/${prepared.tournament.slug}`)
  await expect(page.getByRole('region', { name: /^Chave de/ })).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  // Antes eram 6 páginas: a 1ª só com o cabeçalho, a chave empurrada e uma última em branco.
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  expect(pageCount(pdf)).toBeLessThanOrEqual(3)
})
