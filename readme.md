# BirdieAtlas

Plataforma web para gestão de campeonatos de badminton: atletas, clubes, duplas, torneios, inscrições, chaves, partidas e rankings, com portal público.

## Documentação

- [Especificação](docs/ESPECIFICACAO_COMPLETA.md): fonte de verdade de arquitetura, contratos, regras de negócio e convenções.
- [Progresso](PROGRESS.md): o que está pronto, o que falta e as dívidas técnicas.
- [Redesign](docs/REDESIGN.md): decisões do redesign e o motivo delas.
- [Contrato de inscrições](docs/api/tournament-registrations.md): contrato do PR 3b.
- [Fluxo de trabalho](workflow.md): da branch ao merge, com gates, verificação e checklist do PR.
- [Instalação em máquina nova](docs/SETUP.md): roteiro para o Claude Code instalar e verificar tudo sozinho.
- [CLAUDE.md](CLAUDE.md): regras para agentes de código.

## Rodando localmente

Requisitos: Node.js 20+, pnpm 9 e Docker.

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @birdie-atlas/api db:migrate
pnpm --filter @birdie-atlas/api db:seed
pnpm dev
```

- Web: http://localhost:3000 (admin em `/admin`)
- API: http://localhost:3001

`DEV_ADMIN_MODE=true` no `.env` da API libera as escritas enquanto não há autenticação. Para recriar o banco local do zero: `pnpm --filter @birdie-atlas/api db:reset`.

## Configurar em outra máquina (Claude Code)

O repositório já traz o que é do projeto: `CLAUDE.md`, os agents `birdie-reviewer` e `birdie-verifier` (`.claude/agents/`), os plugins e marketplaces em `.claude/settings.json`, as skills em `.claude/skills/` e `.claude/launch.json` (API na 3001, web na 3000). Ao abrir o projeto no Claude Code, aceite a instalação dos plugins pedidos e reinicie a sessão.

O roteiro completo para preparar uma máquina nova, que o próprio Claude Code pode seguir sozinho, está em [`docs/SETUP.md`](docs/SETUP.md).

Plugins pessoais, fora do projeto (instale com `/plugin` se quiser): `caveman` (`JuliusBrussee/caveman`), `claude-code-setup` e `rust-analyzer-lsp` (`claude-plugins-official`).

A memória do Claude Code (`~/.claude/projects/...`) e as configurações pessoais (`~/.claude/settings.json`: modelo, hooks, variáveis) não são do projeto e não vão para o Git.

## Testes E2E

Testes de ponta a ponta com [Playwright](https://playwright.dev) em `apps/e2e`: portal público, ciclo de vida do torneio no admin, agenda automática, placar ao vivo (SSE), tema, guard de modo admin e uma fumaça de acessibilidade.

```bash
docker compose up -d      # Postgres
pnpm e2e:install          # só na primeira vez: baixa o Chromium
pnpm e2e                  # roda tudo (também aceita argumentos: pnpm e2e tests/live.spec.ts)
```

- **Isolado do desenvolvimento:** banco próprio `birdieatlas_e2e` (recriado do zero a cada execução com `db:create`, `db:reset` e `db:seed`), API em http://localhost:3201 e web em http://localhost:3200. Os servidores de desenvolvimento (3000/3001) e o banco `birdie_atlas` não são tocados.
- **Web de produção:** o Playwright roda `next build` (saída em `apps/web/.next-e2e`) e `next start`. O build leva alguns minutos; com `E2E_SKIP_BUILD=1` o build anterior é reaproveitado.
- **Variáveis:** `E2E_API_PORT`, `E2E_WEB_PORT` e `E2E_DATABASE_URL` (o nome do banco precisa conter "e2e").
- **Depuração:** `pnpm --filter @birdie-atlas/e2e e2e:report` abre o relatório HTML; falhas guardam captura de tela e, na primeira repetição, o trace (`playwright show-trace`). Para ver o navegador: `pnpm e2e --headed`.
- **CI:** o job `e2e` do GitHub Actions roda a mesma suíte e envia o relatório e os traces como artefato quando falha.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | API e web em modo de desenvolvimento |
| `pnpm turbo run check-types lint test build` | O mesmo que o job `verify` do CI |
| `pnpm e2e` | Testes E2E com Playwright (banco e portas próprios; ver "Testes E2E") |
| `pnpm --filter @birdie-atlas/api db:generate` | Gera uma migration a partir do schema |
| `pnpm --filter @birdie-atlas/api db:migrate` | Aplica as migrations pendentes |
| `pnpm --filter @birdie-atlas/api db:create` | Cria o banco apontado por `DATABASE_URL` se ele não existir (só local; usado pelo E2E) |
| `pnpm --filter @birdie-atlas/api db:reset` | Recria o banco local a partir das migrations (só local) |
| `pnpm --filter @birdie-atlas/api db:seed` | Popula o banco com dados de exemplo |
| `pnpm --filter @birdie-atlas/api db:studio` | Abre o Drizzle Studio |
