import { expect, type Page } from '@playwright/test'
import type { WcagData } from './wcag-data.js'

// Rotas auditadas (públicas e do admin) com o que garante que a página terminou de carregar dados reais.
// Usado pelos specs `wcag.spec.ts` (axe) e `wcag-targeted.spec.ts` (verificações que o axe não faz).

export interface PageCase {
  name: string
  path: () => string
  /** Garante que a página terminou de carregar os dados (e leva à aba/estado auditado). */
  ready: (page: Page) => Promise<void>
}

const heading = (page: Page, name: string | RegExp, level?: number) =>
  expect(page.getByRole('heading', { name, ...(level ? { level } : {}) }).first()).toBeVisible()

const openTab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true }).click()

export function publicPages(data: () => WcagData): PageCase[] {
  return [
  {
    name: 'início',
    path: () => '/',
    ready: async (p) => {
      await expect(p.getByRole('region', { name: 'Top 10 dos rankings' }).getByRole('tablist')).toBeVisible()
    },
  },
  {
    name: 'início com busca',
    path: () => `/?q=${encodeURIComponent('Acesso')}`,
    ready: async (p) => {
      await heading(p, /Resultados para/)
      await expect(p.getByRole('link', { name: /Acesso 01/ }).first()).toBeVisible()
    },
  },
  {
    name: 'ranking',
    path: () => '/r/fpb-sp',
    ready: async (p) => {
      await heading(p, 'Ranking', 1)
      // Carregou: ou há entradas (links para atletas) ou o aviso de vazio.
      await expect(p.locator('a[href^="/a/"]').or(p.getByText('Nenhuma entrada encontrada')).first()).toBeVisible()
    },
  },
  {
    name: 'torneio encerrado (chave, pódio)',
    path: () => `/t/${data().completed.tournament.slug}`,
    ready: async (p) => {
      await expect(p.getByRole('region', { name: /^Chave de/ })).toBeVisible()
    },
  },
  {
    name: 'torneio com partida ao vivo',
    path: () => `/t/${data().running.tournament.slug}`,
    ready: async (p) => {
      const live = p.getByRole('region', { name: 'Ao vivo agora' })
      await expect(live.getByText('Ao vivo', { exact: true })).toBeVisible()
      await expect(live.getByRole('article')).toBeVisible()
    },
  },
  {
    name: 'torneio inexistente',
    path: () => '/t/torneio-que-nao-existe',
    ready: (p) => heading(p, 'Torneio não encontrado'),
  },
  {
    name: 'atleta (pódios, ranking, clube)',
    path: () => `/a/${data().champion.id}`,
    ready: (p) => heading(p, data().champion.name, 1),
  },
  {
    name: 'atleta inexistente',
    path: () => '/a/00000000-0000-0000-0000-000000000000',
    ready: (p) => heading(p, /não encontrado/i),
  },
  {
    name: 'clube',
    path: () => `/c/${data().club.slug}`,
    ready: (p) => heading(p, data().club.name, 1),
  },
  {
    name: 'rota inexistente (404)',
    path: () => '/pagina-que-nao-existe',
    ready: async (p) => {
      await expect(p.getByRole('heading', { level: 1 })).toBeVisible()
    },
  },
  ]
}

export function adminPages(data: () => WcagData): PageCase[] {
  return [
  { name: 'dashboard', path: () => '/admin', ready: (p) => heading(p, 'Dashboard', 1) },
  {
    name: 'atletas',
    path: () => '/admin/athletes',
    ready: async (p) => {
      await expect(p.getByRole('table')).toBeVisible()
      await expect(p.getByRole('row').nth(1)).toBeVisible()
    },
  },
  {
    name: 'duplas',
    path: () => '/admin/pairs',
    ready: async (p) => {
      await heading(p, 'Duplas', 2)
      await expect(p.getByText(/Parceiro Acessível/).first()).toBeVisible()
    },
  },
  {
    name: 'clubes',
    path: () => '/admin/clubs',
    ready: async (p) => {
      await heading(p, 'Clubes', 2)
      await expect(p.getByText(data().club.name).first()).toBeVisible()
    },
  },
  {
    name: 'clube (detalhe)',
    path: () => `/admin/clubs/${data().club.id}`,
    ready: (p) => heading(p, data().club.name),
  },
  {
    name: 'torneios',
    path: () => '/admin/tournaments',
    ready: async (p) => {
      await heading(p, 'Torneios', 2)
      await expect(p.locator('a[href^="/admin/tournaments/"]').first()).toBeVisible()
    },
  },
  {
    name: 'torneio: inscrições (pendentes)',
    path: () => `/admin/tournaments/${data().open.tournament.id}`,
    ready: async (p) => {
      await heading(p, data().open.tournament.name, 2)
      await expect(p.getByText(/Inscrito 02/).first()).toBeVisible()
    },
  },
  {
    name: 'torneio: chaveamento (em andamento)',
    path: () => `/admin/tournaments/${data().running.tournament.id}`,
    ready: async (p) => {
      await openTab(p, 'Chaveamento')
      await expect(p.getByRole('region', { name: /^Chave de/ })).toBeVisible()
    },
  },
  {
    name: 'torneio: chaveamento (encerrado)',
    path: () => `/admin/tournaments/${data().completed.tournament.id}`,
    ready: async (p) => {
      await openTab(p, 'Chaveamento')
      await expect(p.getByRole('region', { name: /^Chave de/ })).toBeVisible()
    },
  },
  {
    name: 'torneio: agenda',
    path: () => `/admin/tournaments/${data().running.tournament.id}`,
    ready: async (p) => {
      await openTab(p, 'Agenda')
      await expect(p.getByText('Quadra 1').first()).toBeVisible()
    },
  },
  {
    name: 'torneio: configurações',
    path: () => `/admin/tournaments/${data().running.tournament.id}`,
    ready: async (p) => {
      await openTab(p, 'Configurações')
      await expect(p.getByRole('tabpanel').getByRole('heading').first()).toBeVisible()
    },
  },
  {
    name: 'ao vivo (operador, quadra com partida)',
    path: () => '/admin/live',
    ready: async (p) => {
      await p.getByLabel('Torneio').selectOption({ label: data().running.tournament.name })
      await p.getByRole('button', { name: /^Quadra 1/ }).click()
      await expect(p.getByRole('region', { name: /^Partida ao vivo:/ })).toBeVisible()
    },
  },
  {
    name: 'rankings',
    path: () => '/admin/rankings',
    ready: async (p) => {
      await heading(p, 'Rankings', 2)
      await expect(p.getByText(data().ranking.name).first()).toBeVisible()
    },
  },
  {
    name: 'ranking (detalhe, regras de pontos)',
    path: () => `/admin/rankings/${data().ranking.id}`,
    ready: (p) => heading(p, data().ranking.name),
  },
  ]
}
