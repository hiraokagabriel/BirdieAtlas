# BirdieAtlas — Progresso

> Atualizado em 21/10/2026.
> Regras e contratos: [`docs/ESPECIFICACAO_COMPLETA.md`](docs/ESPECIFICACAO_COMPLETA.md). Decisões do redesign: [`docs/REDESIGN.md`](docs/REDESIGN.md).
> Atualize este arquivo no PR que concluir ou abrir um item.
>
> **Diretriz (31/10/2026):** o projeto roda localmente, em rede local. A autenticação Clerk (e tudo que depende de identidade: auditoria, usuários e papéis, notificações) é a **última** entrega e só existirá na build que rodar online.

## Redesign

| Entrega | Situação |
|---|---|
| 1. Fundação | ✅ PR #10 |
| 2. Contratos da API | ✅ PR #11 |
| 3a. Baseline de migrations e schema | ✅ PR #13 |
| 3b. Inscrições (`status`/`notes`, atleta XOR dupla, `/registrations`) | ✅ PR #16 |
| 3c. Aposentadoria de `pointsTables` | ✅ PR #17 |
| 4. Ciclo de vida do torneio | ✅ PR #12 |
| 5. Documentação | ✅ PR #15 |

Fora do plano: o seed passou a gerar chaves com a rodada 1 como final (PR #14).

Depois do plano: `finalPlacement` gravado no encerramento (PR #18) e lint do web zerado (PR #19).

## Revamp visual "Atlas esportivo"

| Entrega | Situação |
|---|---|
| Tokens e tipografia (verde-quadra, amarelo-peteca, Barlow Condensed) | ✅ PR #20 |
| Home pública e perfil do atleta | ✅ PR #21 |
| Chave visual (admin e pública) | ✅ PR #22 |
| Dark mode (toggle claro/escuro/sistema) | ✅ PR #24 |

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
| Agenda automática por quadra e horário | ✅ | `POST /tournaments/:id/schedule/auto` com pré-visualização; sem mudança de schema; a janela diária (`dayStartsAt`, `dayEndsAt`) só existe na API, não na tela |
| Auditoria de resultados (quem e quando) | ❌ | |
| Placar ao vivo por quadra | ✅ | Tela do operador `/admin/live`, API de início, ponto, desfazer e encerramento, stream SSE público e seção "Ao vivo agora" em `/t/[slug]`. Barramento em memória: uma instância de API (ver especificação) |

## Phase 6 — Portal público

| Item | Situação |
|---|---|
| Landing, torneio, rankings, atleta e clube | ✅ |
| Busca pública de atletas (`GET /athletes/search`) | ✅ |
| Imagens de compartilhamento (Open Graph 1200x630 e "story" 1080x1350 do pódio) | ✅ |
| Compartilhar e baixar imagem (torneio, atleta e ranking) | ✅ |
| Impressão / PDF da chave e do ranking (`@media print`) | ✅ |
| Estatísticas e histórico de atletas | ❌ |
| Head-to-head | ❌ |

## Phase 7 — Admin

| Item | Situação | Observação |
|---|---|---|
| Dashboard com dados reais | ✅ | |
| Relatórios exportáveis | ✅ | CSV de inscritos, entradas do ranking, resultados das partidas, classificação final e lista de atletas (admin) |
| Notificações | ❌ | Dependem de provedor de e-mail/WhatsApp e de login |
| Gestão de usuários e papéis | ❌ | Depende do Clerk |

## Phase 8 — Qualidade e mobile

| Item | Situação | Observação |
|---|---|---|
| Testes unitários de domínio (Vitest) | ✅ | |
| Testes E2E com Playwright | 🟡 | `apps/e2e`, `pnpm e2e`, job `e2e` no CI (verificado no GitHub). Cobre: portal público (home, busca, perfil, torneio encerrado com campeão, ranking e CSV, compartilhar, 404), ciclo de vida do torneio no admin (inscrições, sorteio, resultados, encerrar, `TOURNAMENT_LOCKED`, reabrir), agenda automática, placar ao vivo com SSE, tema, guard de modo admin e a auditoria de acessibilidade (axe, teclado e foco). Falta: cadastros (atletas, clubes, duplas), importação de CSV, rankings e regras de pontos no admin, inscrições pela interface |
| PWA e push notifications | ❌ | |
| Acessibilidade WCAG 2.1 AA | 🟡 | Auditoria automática com axe (WCAG A e AA) em 25 rotas e estados, em tema claro e escuro, em desktop e celular, mais 23 overlays abertos (diálogos, sheets, menus), e testes dirigidos de teclado, foco preso e devolvido, Escape, skip link, reflow, alvos de toque, movimento reduzido e `aria-live` (`apps/e2e/tests/wcag*.spec.ts`). Antes das correções o axe achou 185 grupos de violação (366 nós), sobretudo `color-contrast`, `button-name`, `label` e `select-name`; todos corrigidos, com 3 exceções documentadas em `ALLOWED_VIOLATIONS`. Pendente: passada manual com leitor de tela (o axe cobre cerca de um terço dos critérios), impressão e imagens de compartilhamento fora do axe |

## Dívidas técnicas

| Item | Prioridade | Detalhe |
|---|---|---|
| Tela do operador troca de quadra ao cancelar o início | Baixa | Em `/admin/live`, cancelar a partida da quadra 2 volta para a quadra 1: a partida some das "ao vivo" antes de a fila recarregar e a quadra deixa de existir por um instante. `test.fixme` em `apps/e2e/tests/live.spec.ts` |
| Página pública do ranking sem link para o CSV | Baixa | O CSV só existe na API e no botão do admin. `test.fixme` em `apps/e2e/tests/public.spec.ts` |
| `finalize` fora do contrato de erro | Baixa | `POST /tournaments/:id/finalize` devolve `{ error, incomplete }` sem `code` nem `details`; o modal só mostra `error` e perde a lista `incomplete` |
| Revisões por LLM do `security-guidance` desligadas | Baixa | `ENABLE_CODE_SECURITY_REVIEW=0` em `.claude/settings.json` para não gastar uso enquanto o projeto roda só localmente; só os avisos por padrão ficam ativos. Religar (apagar a variável) antes de colocar o projeto na internet |
