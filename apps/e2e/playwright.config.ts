import { defineConfig, devices } from '@playwright/test'
import { API_PORT, API_URL, DATABASE_URL, TENANT_SLUG, WEB_DIST_DIR, WEB_PORT, WEB_URL } from './support/env.js'

const isCI = Boolean(process.env['CI'])

// Servidores próprios do E2E, em portas e banco separados do desenvolvimento.
// - API: `tsx src/index.ts` (mesmo código do `pnpm dev`, sem watch) no banco `birdieatlas_e2e`.
// - Web: build de produção (`next build` + `next start`), mais fiel ao que vai ao ar (tema sem flash, SSE,
//   sem o botão flutuante de admin do modo dev). O build vai para `.next-e2e`. Com `E2E_SKIP_BUILD=1`
//   reaproveita o build anterior (iteração rápida; rode sem a variável quando o código do web mudar).
// A API sobe antes do banco existir: ela só conecta na primeira requisição, e o `global-setup`
// cria, migra e popula o banco antes do primeiro teste.
const apiCommand = 'pnpm --filter @birdie-atlas/api exec tsx src/index.ts'
const webBuild = process.env['E2E_SKIP_BUILD'] ? '' : 'pnpm --filter web exec next build && '
const webCommand = `${webBuild}pnpm --filter web exec next start -p ${WEB_PORT}`

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',

  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: isCI,
  // Teste instável é falha: o retry do CI existe só para gerar o trace do primeiro erro.
  retries: isCI ? 1 : 0,
  // Cada spec cria os próprios dados (torneio, atletas) e só mexe neles, então os specs do projeto
  // `main` rodam em paralelo com segurança. O projeto `guard` liga e desliga o modo admin da API
  // inteira, por isso roda sozinho, depois do `main`.
  workers: isCI ? 2 : 2,
  fullyParallel: false,
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'main',
      testIgnore: /guard\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'guard',
      testMatch: /guard\.spec\.ts/,
      dependencies: ['main'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: apiCommand,
      url: `${API_URL}/dev/admin-mode`,
      reuseExistingServer: false,
      timeout: 60_000,
      // O log por requisição do Fastify é ruído; erros de inicialização saem em stderr.
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        PORT: String(API_PORT),
        DATABASE_URL,
        DEFAULT_TENANT_SLUG: TENANT_SLUG,
        DEV_ADMIN_MODE: 'true',
      },
    },
    {
      command: webCommand,
      // Página do admin que não consulta a API no servidor (o banco ainda não existe quando o web sobe).
      url: `${WEB_URL}/admin/live`,
      reuseExistingServer: false,
      timeout: 600_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PORT: String(WEB_PORT),
        NEXT_DIST_DIR: WEB_DIST_DIR,
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_SITE_URL: WEB_URL,
      },
    },
  ],
})
