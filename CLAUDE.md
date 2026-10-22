# BirdieAtlas — regras para agentes

A fonte de verdade é [`docs/ESPECIFICACAO_COMPLETA.md`](docs/ESPECIFICACAO_COMPLETA.md). Leia a seção relevante antes de mudar comportamento, contrato ou schema, e atualize-a no mesmo PR. O andamento fica em [`PROGRESS.md`](PROGRESS.md).

## Antes de entregar

- Rode `pnpm turbo run check-types lint test build`: é o que o CI roda.
- Regra de domínio nova vai para `apps/api/src/domain` ou `packages/validators`, com teste.
- Commits em Conventional Commits. Nunca commitar direto na `main`: trabalhe numa branch e abra PR.

## Regras que não se negociam

- TypeScript estrito, sem `any`. Na API, imports relativos terminam em `.js`.
- Todo input da API passa por Zod antes da lógica. Erros seguem `{ error, code?, details? }`, pelo handler único em `apps/api/src/http/errors.ts`.
- Coleções de topo devolvem `{ data, pagination }`.
- Autorização é feita pelo guard global em `apps/api/src/middleware/admin-guard.ts`, nunca dentro do handler. Toda escrita exige modo admin.
- Endpoints públicos nunca devolvem e-mail, CPF, telefone ou data de nascimento: use `publicAthleteColumns`.
- O tenant vem do servidor (`DEFAULT_TENANT_SLUG`). Ignore `tenantId` enviado pelo cliente.
- Registros de negócio usam soft delete (`deletedAt`). Não apague fisicamente.
- Status do torneio só muda pelo ciclo de vida (`packages/validators/src/tournament.ts`), nunca por edição direta.

## Banco de dados

- Schema único em `apps/api/src/db/schema.ts`. Mudou o schema: `db:generate`, revise o SQL, `db:migrate`. `db:push` é proibido.
- `db:reset` apaga o banco local e recria pelas migrations; depois rode `db:seed`. O banco local é descartável.
- Em `matches`, a rodada 1 é a final e a rodada de número mais alto é a primeira fase. Use o gerador de `apps/api/src/domain/bracket.ts`; não monte chaves à mão.

## Web

- Next.js 16 difere das versões que você conhece: leia `apps/web/AGENTS.md` e o guia em `node_modules/next/dist/docs/` antes de escrever código web.
- Admin usa TanStack Query com `apiFetch` (`apps/web/src/lib/api.ts`); páginas públicas são Server Components.
- Navegação só em `apps/web/src/lib/navigation.ts`. Nunca crie outra sidebar, shell ou layout administrativo.
- Toda tela trata carregamento, erro, vazio e sucesso, só com dados reais da API.
- UI nova mantém o spec WCAG verde (axe + teclado, em `apps/e2e`): campo com `Field`, escolha exclusiva com `ChoiceGroup`, abas com `Tabs`, diálogo com `Dialog`, ícone sem texto com `aria-label`. Rodar: `pnpm --filter @birdie-atlas/e2e exec playwright test wcag --project=main`. Exceção só em `ALLOWED_VIOLATIONS` (`apps/e2e/support/axe.ts`), com motivo e critério; nunca desligar regra inteira.

## Testes E2E

- `pnpm e2e` roda o Playwright de `apps/e2e` (precisa do Postgres: `docker compose up -d`). Primeira vez: `pnpm e2e:install` (só o Chromium). Não faz parte de `pnpm turbo run check-types lint test build`; só o `check-types` e o `lint` do pacote entram lá.
- O E2E usa banco e portas próprios, para não tocar no ambiente de desenvolvimento: banco `birdieatlas_e2e` (apagado e recriado pelo `global-setup`), API na 3201 e web na 3200 (build de produção em `.next-e2e`). Nunca aponte `E2E_DATABASE_URL` para `birdie_atlas`: o setup recusa nomes sem "e2e".
- Cada spec cria os próprios dados pela API (`apps/e2e/support/factories.ts`) e usa locators por papel e rótulo. Teste instável é falha: corrija a causa. Comportamento ainda não implementado vira `test.fixme` com o motivo, nunca asserção enfraquecida.
- Depurar: `pnpm --filter @birdie-atlas/e2e e2e:report` abre o relatório HTML; o trace da primeira repetição fica em `apps/e2e/test-results` (`pnpm --filter @birdie-atlas/e2e exec playwright show-trace <trace.zip>`). `E2E_SKIP_BUILD=1` reaproveita o build do web (rode sem ele quando o código do web mudar).

## Agentes do projeto

- Em `.claude/agents/`: `birdie-verifier` (verificação independente antes do commit: pipeline, API, navegador, privacidade; não edita código) e `birdie-reviewer` (revisão somente leitura do diff contra estas regras). Quem implementa não é quem verifica: use o verificador depois de cada mudança de comportamento e o revisor antes do PR.
- Todo briefing de agente nomeia a branch e proíbe commit, push, `db:push` e mexer no banco `birdie_atlas` e nas portas 3000/3001; verificação pesada usa o banco e as portas do E2E.

## Ambiente local

- `apps/api/.env` precisa de `DEFAULT_TENANT_SLUG=fpb-sp` e `DEV_ADMIN_MODE=true` (ver `.env.example`).
- PostgreSQL: `docker compose up -d`.
- Textos em português com acentuação correta, arquivos em UTF-8.
