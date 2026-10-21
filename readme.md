# BirdieAtlas

Plataforma web para gestão de campeonatos de badminton: atletas, clubes, duplas, torneios, inscrições, chaves, partidas e rankings, com portal público.

## Documentação

- [Especificação](docs/ESPECIFICACAO_COMPLETA.md): fonte de verdade de arquitetura, contratos, regras de negócio e convenções.
- [Progresso](PROGRESS.md): o que está pronto, o que falta e as dívidas técnicas.
- [Redesign](docs/REDESIGN.md): decisões do redesign e o motivo delas.
- [Contrato de inscrições](docs/api/tournament-registrations.md): contrato do PR 3b.
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

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | API e web em modo de desenvolvimento |
| `pnpm turbo run check-types lint test build` | O mesmo que o CI |
| `pnpm --filter @birdie-atlas/api db:generate` | Gera uma migration a partir do schema |
| `pnpm --filter @birdie-atlas/api db:migrate` | Aplica as migrations pendentes |
| `pnpm --filter @birdie-atlas/api db:reset` | Recria o banco local a partir das migrations (só local) |
| `pnpm --filter @birdie-atlas/api db:seed` | Popula o banco com dados de exemplo |
| `pnpm --filter @birdie-atlas/api db:studio` | Abre o Drizzle Studio |
