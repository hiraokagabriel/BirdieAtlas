# BirdieAtlas — Progresso

> Atualizado em 19/10/2026, na `main`.
> Regras e contratos: [`docs/ESPECIFICACAO_COMPLETA.md`](docs/ESPECIFICACAO_COMPLETA.md). Decisões do redesign: [`docs/REDESIGN.md`](docs/REDESIGN.md).
> Atualize este arquivo no PR que concluir ou abrir um item.

## Redesign

| Entrega | Situação |
|---|---|
| 1. Fundação | ✅ PR #10 |
| 2. Contratos da API | ✅ PR #11 |
| 3a. Baseline de migrations e schema | ✅ PR #13 |
| 3b. Inscrições (`status`/`notes`, atleta XOR dupla, `/registrations`) | 🔄 Em PR |
| 3c. Aposentadoria de `pointsTables` | 🔄 Em PR |
| 4. Ciclo de vida do torneio | ✅ PR #12 |
| 5. Documentação | ✅ PR #15 |

Fora do plano: o seed passou a gerar chaves com a rodada 1 como final (PR #14).

## Phase 0 — Fundação

| Item | Situação | Observação |
|---|---|---|
| Monorepo pnpm + Turborepo, TypeScript estrito | ✅ | |
| PostgreSQL local via `docker compose` | ✅ | |
| Migrations versionadas, `db:reset` e `db:seed` | ✅ | Histórico começa em `0000_baseline.sql`; `db:push` proibido |
| `packages/validators` e `packages/types` | ✅ | |
| CI: typecheck, lint, testes e build | ✅ | Em todo push e PR para `main` |
| Variáveis de ambiente documentadas | ✅ | `apps/api/.env.example` |
| Modo admin de desenvolvimento | ✅ | Guard global em toda escrita e nas leituras com dados pessoais |
| Tenant padrão no servidor | ✅ | `DEFAULT_TENANT_SLUG` |
| Autenticação Clerk, papéis e seletor de tenant | ❌ | Sem Clerk, nenhuma escrita é possível em produção |

## Phase 1 — Atletas, clubes e duplas

| Item | Situação | Observação |
|---|---|---|
| CRUD de atletas | ✅ | Soft delete, e-mail único |
| Importação em lote por CSV | ✅ | Prévia e relatório de erros |
| CRUD de clubes | ✅ | Soft delete, slug único |
| Afiliações atleta ↔ clube | ✅ | Um clube ativo por vez |
| Gestão de duplas | ✅ | `/admin/pairs` |
| Perfil público do atleta (`/a/[athleteId]`) | ✅ | Sem dados pessoais |
| Página pública do clube (`/c/[clubSlug]`) | ✅ | |

## Phase 2 — Torneios, categorias e inscrições

| Item | Situação | Observação |
|---|---|---|
| CRUD de torneios | ✅ | `level` como enum |
| Ciclo de vida validado no servidor | ✅ | Transição, encerramento com pódio e reabertura que reverte pontos |
| Categorias com disciplina e formato | ✅ | |
| Inscrições com status (pendente, aprovada, recusada) | ✅ | Atleta XOR dupla; só aprovadas entram na chave. Aprovar, recusar com motivo, reabrir e remover na aba Inscrições |
| Auditoria de aprovação e recusa (quem e quando) | ❌ | Depende de identidade de usuário (Clerk); hoje só `notes` e `updatedAt`. Contrato em `docs/api/tournament-registrations.md` |
| Elegibilidade na API de inscrição | ✅ | Gênero, atleta ativo, sem inscrição duplicada na categoria e limite de vagas, sob lock da categoria |
| Página pública do torneio (`/t/[slug]`) | ✅ | |

## Phase 3 — Ranking

| Item | Situação | Observação |
|---|---|---|
| Rankings, regras de pontos, vínculos e entradas | ✅ | |
| `award-points` uma única vez por torneio | ✅ | Só com todas as chaves encerradas; vincula o torneio aos rankings com regra para o nível e recalcula |
| Recálculo com regras específicas e genéricas | ✅ | Motor único (`services/ranking-engine.ts`), só `point_rules`; reabrir torneio recalcula pelo mesmo motor |
| `countBestResults` e `minTournamentsRequired` | ✅ | |
| Telas de ranking e regras de pontos | ✅ | `/admin/rankings` |
| Página pública de rankings (`/r/[tenantSlug]`) | ✅ | |
| Remoção de `pointsTables` | ✅ | Linhas convertidas em regras genéricas pela migration; tabela, rotas e telas removidas |
| Critérios de desempate | ❌ | |
| Cache Redis (TTL 1h) | ❌ | |

## Phase 4 — Chaves

| Item | Situação | Observação |
|---|---|---|
| Eliminação simples, sorteio aleatório e com cabeças de chave | ✅ | Gerador em `apps/api/src/domain/bracket.ts` |
| Byes como W.O. na primeira fase | ✅ | |
| Publicação com bloqueio de ressorteio | ✅ | `409 DRAW_PUBLISHED` |
| Ressorteio com reset em cascata | ✅ | |
| Eliminação dupla, round robin, grupos + eliminatória, suíço | ❌ | `draw_type` já prevê os três primeiros |

## Phase 5 — Partidas

| Item | Situação | Observação |
|---|---|---|
| Lançamento de resultado por sets | ✅ | Inclui W.O. e desistência |
| Avanço automático do vencedor | ✅ | Troca de vencedor desfaz as partidas seguintes |
| Agenda: quadra e horário por partida | ✅ | Aba Agenda do torneio |
| Auditoria de resultados (quem e quando) | ❌ | |
| Resultados ao vivo | ❌ | |

## Phase 6 — Portal público

| Item | Situação |
|---|---|
| Landing, torneio, rankings, atleta e clube | ✅ |
| Estatísticas e histórico de atletas | ❌ |
| Head-to-head | ❌ |

## Phase 7 — Admin

| Item | Situação | Observação |
|---|---|---|
| Dashboard com dados reais | ✅ | |
| Relatórios exportáveis | ❌ | |
| Notificações | ❌ | |
| Gestão de usuários e papéis | ❌ | Depende do Clerk |

## Phase 8 — Qualidade e mobile

| Item | Situação |
|---|---|
| Testes unitários de domínio (Vitest) | ✅ |
| Testes E2E com Playwright | ❌ |
| PWA e push notifications | ❌ |
| Acessibilidade WCAG 2.1 AA | ❌ |

## Dívidas técnicas

| Item | Prioridade | Detalhe |
|---|---|---|
| `finalPlacement` nunca é gravado | 🟡 Média | A API deriva a colocação da chave toda vez; o seed atribui o campo depois de inserir as inscrições. Decidir entre gravar no encerramento ou remover a coluna |
| Warnings de lint no web | 🟢 Baixa | 21 warnings, sem erros |
| Branches antigas no remoto | 🟢 Baixa | `feat/dashboard-crud-pages` (abandonada), `feat/phase-2-registration-operations` (portada), `chore/fix-dependency-versions`, `main-v2` e as branches de PRs já mergeados |
