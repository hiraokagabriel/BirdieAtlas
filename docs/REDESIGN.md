# BirdieAtlas — Decisões do Redesign

> Registrado em 19/10/2026, após auditoria das branches `main`, `feat/dashboard-crud-pages` e `feat/phase-2-registration-operations`.

## Diagnóstico

- `feat/dashboard-crud-pages` reiniciou o projeto a partir do README (`b02fa77`) e reconstruiu só três páginas. A sidebar apontava para rotas inexistentes, as páginas chamavam `fetch('/api/...')` (Next não tem essas rotas; a API roda em `:3001`), o `QueryProvider` não estava montado e os status de torneio não batiam com o enum do banco.
- `main` tem o app mais completo, mas o typecheck falhava (imports sem `.js` em NodeNext, coluna `points` removida ainda usada no `award-points`, imports radix quebrados) e as rotas planas em route groups causavam colisões.
- `requireAdmin` existia mas não era usado; todas as rotas de escrita estavam abertas.
- Listas devolvem arrays crus, contrariando o contrato `{ data, pagination }`.
- `packages/validators` e `packages/types` não existiam em `main`.
- Quatro documentos (README, CONTEXT, PROGRESS, especificação) se contradiziam.

## Decisões

### Base e branches

1. A base é `main`. O trabalho segue em `fix/redesign-foundation`.
2. `feat/dashboard-crud-pages` é abandonada (não apagada). Aproveitar apenas o hook/toaster de toast.
3. De `feat/phase-2-registration-operations` são portados API de inscrições, `packages/validators`, regras de domínio, testes e documentação. O mockup de UI e a reescrita dos componentes radix ficam de fora.

### Rotas e navegação

4. Área administrativa sob o segmento real `/admin/*`, identificando registros por `id`.
5. Público em `/`, `/t/[slug]`, `/r/[tenantSlug]`, `/a/[athleteId]`, `/c/[clubSlug]` (slug só no público).
6. Navegação apenas para admin e público. Papéis atleta, juiz e super-admin voltam junto com suas páginas.
7. Um teste garante que todo `href` da navegação corresponde a uma rota existente.

### Web

8. TanStack Query em todo o admin, via `apiFetch`. Páginas públicas são Server Components.
9. `apiFetch` lança `ApiError { status, code, message, details }`, interpretando o contrato `{ error, code, details }`.
10. Dashboard só com dados reais da API; mocks removidos. `/` vira a landing pública.

### API

11. `requireAdmin` em todo POST/PUT/PATCH/DELETE e em todo GET que devolva CPF, e-mail ou telefone. Endpoints públicos não expõem esses dados. `/dev/admin-mode` só fora de produção.
12. Toda lista devolve `{ data, pagination: { page, pageSize, total, totalPages } }`, com `page` a partir de 1 e `pageSize` padrão 25, máximo 100.
13. Um tenant padrão aplicado no servidor em todas as consultas e escritas. Seletor de tenant chega com as organizações do Clerk.
14. Ciclo de vida do torneio validado no servidor via `POST /tournaments/:id/transition`:
    `draft → registration_open → registration_closed → in_progress → completed`; `cancelled` a partir de qualquer estado antes de `completed`; `reopen` leva `completed → in_progress`.

### Dados

15. Apenas migrations geradas (`db:generate` / `db:migrate`). `db:push` banido.
16. Soft delete (`deletedAt`) em atletas, clubes, torneios, categorias, inscrições e duplas. Colunas únicas (slug, CPF) com índice único parcial `WHERE deleted_at IS NULL`. Restauração só via API.
17. `tournaments.level` migra de `text` para enum. `rankings.slug` preenchido a partir do nome.
18. Inscrições referenciam `athleteId` XOR `pairId`. Duplas são criadas a partir de `athlete2Id`, que depois é removido.
19. `pointsTables` aposentado: linhas convertidas em `pointRules` genéricas; tabela, rotas e UI removidas.

### Pacotes e qualidade

20. `packages/validators` e `packages/types` reais, com schemas Zod compartilhados entre API e web.
21. CI: typecheck, lint, `next build` e vitest. Playwright fica para a Phase 8.

### Documentação

22. A especificação (`docs/ESPECIFICACAO_COMPLETA.md`) é a fonte de verdade; `PROGRESS.md` reescrito conforme a realidade; README curto com links; `CONTEXT.md` removido e suas regras movidas para a especificação e `CLAUDE.md`.

## Entregas

A situação de cada entrega fica no [`PROGRESS.md`](../PROGRESS.md).

Cada item é um PR para `main`, nesta ordem:

1. **Fundação** — branch, typecheck verde, workspace, validators/types, regras de domínio e contratos de inscrição portados, `ApiError`, mudança para `/admin`, navegação admin + público, teste de rotas da navegação, CI.
2. **Contratos da API** — `requireAdmin` + separação de dados pessoais, paginação, escopo de tenant e atualização dos clientes.
3. **Migrations de schema**, dividido em três PRs:
   - **3a** — histórico de migrations novo (baseline), soft delete com índices únicos parciais, `tournaments.level` como enum, `rankings.slug` único por tenant.
   - **3b** — inscrições: `status`/`notes` no lugar de `confirmed`/`withdrew`, `athleteId` XOR `pairId` no lugar de `athlete2Id`, endpoints `/registrations`.
   - **3c** — aposentadoria de `pointsTables`: `award-points` e o motor de ranking só com `pointRules`.
4. **Ciclo de vida do torneio** — endpoint de transição e UI ciente do status.
5. **Documentação** — consolidação da especificação, reescrita do PROGRESS, remoção do CONTEXT, regras no `CLAUDE.md`.

## Dados pessoais

Considerados sensíveis: CPF, e-mail e telefone. O schema atual guarda apenas e-mail e data de nascimento dos atletas; ambos são tratados como dados pessoais.

## Notas de implementação

### PR 2 — Contratos da API

- **Guard**: hook global `onRequest` (`apps/api/src/middleware/admin-guard.ts`). Toda escrita exige modo admin; leituras com dados pessoais (`GET /athletes`, `GET /athletes/:id`) também. Preflight `OPTIONS` e `/dev/admin-mode` ficam fora. Em produção, sem Clerk, nenhuma escrita é possível.
- **Dados pessoais**: respostas públicas usam `publicAthleteColumns` (`apps/api/src/db/public-columns.ts`). O web deixou de buscar `/athletes` para montar nomes; usa `athleteName`/`athlete2Name` das inscrições.
- **Tenant**: `DEFAULT_TENANT_SLUG` (ou o único tenant). `tenantId` enviado pelo cliente é ignorado. Atletas continuam globais (identidade entre federações); o vínculo com o tenant é a afiliação.
- **Paginação**: coleções de topo (`athletes`, `clubs`, `tournaments`, `pairs`, `rankings`, `tenants`, entradas de ranking). Listas filhas de um recurso (partidas de uma chave, inscrições de uma categoria, categorias de um torneio, regras de pontos, afiliações) seguem completas: paginar uma chave de 128 atletas a quebraria. `points-tables` não foi paginado porque será removido no PR 3.
- **Erros**: um único handler; Zod vira 400 `VALIDATION_ERROR` com `details`, erros de cliente do Fastify mantêm o status, o resto vira 500 `INTERNAL_ERROR` sem vazar mensagem.

### PR 4 — Ciclo de vida do torneio

- Tabela de transições única em `packages/validators/src/tournament.ts`, usada pela API e pelo web.
- `POST /tournaments/:id/transition { to }` cobre as transições simples, com compare-and-set no status (409 `TOURNAMENT_STATUS_CHANGED` em corrida). Encerrar continua em `/finalize` (pódio) e reabrir em `/reopen` (reverte pontos); a rota de transição responde 409 `USE_DEDICATED_ENDPOINT` para elas.
- `/finalize` agora exige `in_progress`; inscrições novas são recusadas em torneio encerrado ou cancelado (409 `TOURNAMENT_LOCKED`).
- Antes deste PR não havia como tirar um torneio de `draft` pela interface.

### PR 3a — Baseline e schema

- Só existe o banco local de desenvolvimento, com dados de seed. As 4 migrations antigas nunca tinham sido aplicadas (o banco foi todo criado com `db:push`), então o histórico recomeça em `0000_baseline.sql`, gerado do schema atual. Sem código de backfill: não há dados reais a converter.
- `db:push` saiu dos scripts. `db:reset` recria o banco a partir das migrations e recusa produção ou host não local.
- Exclusão vira `deletedAt` em atletas, clubes, torneios, inscrições e duplas (categorias ganham a coluna; não há rota de exclusão). Listas, buscas por id/slug e a geração de chave ignoram excluídos; nomes em chaves e históricos continuam aparecendo.
- Índices únicos parciais (`WHERE deleted_at IS NULL`) em e-mail de atleta, slug de clube e de torneio, e `(tenant, slug)` de ranking. Violação vira 409 `UNIQUE_VIOLATION`.
- Desativar dupla agora é `PUT { active: false }`; `DELETE` exclui.
- A aba de configurações do torneio oferecia níveis (`municipal`, `estadual`…) que nunca casavam com os valores gravados e um seletor de status que a API ignorava; agora usa o enum compartilhado e o status só muda pelo ciclo de vida.

### PR 3b — Inscrições

- **Duas migrations (expandir e contrair)**, para poder testar o backfill com dados reais antes de apagar colunas. A `0001` adiciona `pair_id`, `status` e `notes`, torna `athlete_id` opcional e faz o backfill: `confirmed`/`withdrew` viram `status` (recusada recebe o motivo "Desistência registrada antes da migração"), cada par de atletas de duplas vira uma linha em `pairs` (reaproveitando duplas já existentes, preservando a ordem original dos atletas) e a inscrição aponta para ela. Dados inconsistentes (simples com parceiro, dupla sem parceiro) abortam a migração em vez de serem adivinhados. A `0002` remove `athlete2_id`, `confirmed` e `withdrew` e cria a constraint XOR e os índices únicos.
- Verificado antes de apagar as colunas, em banco populado (559 inscrições, 319 de duplas): mesmos atletas em cada dupla, simples intactas, status iguais às flags antigas e nenhuma linha perdida.
- Uma única porta de leitura, `selectRegistrations` (`apps/api/src/db/registrations.ts`), resolve os atletas pela dupla. Chaves, pontos, ranking, dashboard e perfil do atleta passam por ela; nenhum código lê `athleteId`/`pairId` direto.
- Regras de elegibilidade em `apps/api/src/domain/eligibility.ts`, que também substituiu três cópias das mesmas funções de gênero e disciplina (em `draws.ts` e `rankings.ts`).
- Inscrever roda numa transação que trava a linha da categoria. Teste com 5 inscrições simultâneas para a última vaga: 1 vence, 4 recebem 409.
- A interface de inscrições antes não tinha como aprovar nada (só `confirmed: true` por rota que nenhuma tela chamava), então uma inscrição nova nunca entrava na chave. Agora há aprovar, recusar com motivo, reabrir e remover.
- Refazer a chave apagava as partidas antes de validar que havia 2 inscritos aprovados; agora valida primeiro e troca a chave numa transação.
- O CORS só liberava GET, HEAD e POST, então o navegador bloqueava todo PUT, PATCH e DELETE da API. Passou despercebido porque os testes eram feitos com `curl`, que não passa por CORS.
- Fora do escopo: auditoria de quem aprovou ou recusou depende de identidade de usuário e entra com o Clerk.

### PR 5 — Documentação

- A especificação foi reescrita a partir do código: stack real (Next.js 16, Fastify 5), rotas `/admin` e públicas, contratos, schema, regras de negócio e convenções. As regras do antigo `CONTEXT.md` entraram nela e no `CLAUDE.md` da raiz.
- O `CONTEXT.md` só existia em `feat/dashboard-crud-pages` e nunca chegou à `main`; não há arquivo a remover.
- `PROGRESS.md` reflete a `main` atual e lista as dívidas técnicas conhecidas. O README ficou curto, com setup e links.
