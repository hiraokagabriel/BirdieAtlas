# BirdieAtlas — Progresso

> Atualizado em 26/11/2026.
> Regras e contratos: [`docs/ESPECIFICACAO_COMPLETA.md`](docs/ESPECIFICACAO_COMPLETA.md). Decisões do redesign: [`docs/REDESIGN.md`](docs/REDESIGN.md).
> Atualize este arquivo no PR que concluir ou abrir um item.
>
> **Diretriz (14/11/2026):** a versão online foi aprovada com custo zero e sem domínio próprio: plano em [`docs/PLANO_ONLINE.md`](docs/PLANO_ONLINE.md) (Vercel Hobby, Render Free, Neon Free). O atleta guarda só nome, ano de nascimento e dados esportivos. A identidade de usuário (Better Auth, no lugar do Clerk) é a **última** fase.

## Estado atual (26/11/2026)

- **Online:** Neon (Postgres 16), Render (API) e Vercel (web), todos em AWS US East, seguindo [`docs/PRODUCAO.md`](docs/PRODUCAO.md); o deploy da API roda pelo workflow **Deploy** depois do CI na `main` (migrations antes). O banco de produção tem hoje dados sintéticos de demonstração (torneios em todos os estados e formatos, partidas ao vivo); antes do uso real ele precisa ser limpo e recarregado. Localmente o app continua em API 3001, web 3000, Postgres no Docker na porta 5433.
- **Entregue (#109):** configuração da categoria: pontuação por categoria (21, 15, 11 ou personalizada; ao vivo, resultado e W.O.), padrão de grupos/suíço/reset no cadastro, editar e excluir categoria, prazo de inscrição. Migration `0016`.
- **Em andamento:** importação para dentro de um torneio já criado (branch `feat/import-into-tournament`): `POST /tournaments/:id/import`, botão no cabeçalho do torneio, coluna Pontuação, modelo `.xlsx` formatado com listas de opções e `.csv` em `apps/web/public/modelos` (regerar com `pnpm --filter web template:import`).
- **Próximos passos:** fase 4 (backup no Neon), 5 (segurança e LGPD: `/privacidade` precisa do texto da federação; religar `ENABLE_CODE_SECURITY_REVIEW`), 6 (Better Auth) e 7 (push), conforme [`docs/PLANO_ONLINE.md`](docs/PLANO_ONLINE.md).
- **Entregue de #79 a #106:** amistoso com jogadores avulsos (lista colada, planilha `modelo-importacao-torneio.xlsx`, avulso ligado à federação, juntar avulso com atleta cadastrado); página "Encontre sua próxima partida" (`/t/[slug]/jogador/[athleteId]`) com placar ao vivo, bye e "Se vencer"; "Próximas partidas" dentro do perfil do atleta; linha de partida em três colunas com links (agenda, head-to-head, perfis, chave da categoria); links de deep link `?categoria=`, `?aba=agenda|inscritos` no torneio e `?ranking=` no ranking; seletor de categoria em grade Modalidade × Classe com navegação por setas; ícones duotone próprios (`components/icons/ba.tsx`); datas em UTC no admin e na importação; versão de contrato da API (`x-api-contract`, `API_CONTRACT_VERSION=2`, aviso no web); E2E pela API em `127.0.0.1`; dev do web com 4 GB de heap.
- **Pendências conhecidas:** passada manual com leitor de tela (`docs/ACESSIBILIDADE_LEITOR_DE_TELA.md`); clube nas linhas do ranking (API); hover amarelo (`--accent`) dos menus suspensos; notificações e gestão de usuários dependem de login.
- **Armadilhas do ambiente local:** se o CSS parecer velho (controles com 2 px), apague `apps/web/.next/dev` e reinicie; depois de rodar dev ou verificação, restaure `apps/web/tsconfig.json` com `git checkout`; pare o ambiente de verificação (portas 3200/3201) antes de rodar o E2E.

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
| Padronização visual: `docs/DESIGN.md`, `docs/PRODUCT.md`, templates em `docs/design/` e agente `birdie-designer` | ✅ Documento e os 5 passos da migração (PRs #68 a #78): 1 tokens e fontes; 2 componentes `ui`; 3a moldura pública e home; 3b torneio; 3c atleta, clube e ranking; 4a moldura do admin; 4b quadras e "Precisa de você"; 4c tabelas e listas; 4d diálogo de resultado; 5 telão e impressão. Pendentes fora da migração: clube nas linhas do ranking (API), hover amarelo (`--accent`) dos menus suspensos |
| Ícones de domínio próprios (set duotone do BA: navegação, torneio, clube, ao vivo, ranking, agenda, local) | ✅ `components/icons/ba.tsx`, `docs/DESIGN.md` Iconografia |
| Seletor de categoria (pílulas até 8; grade Modalidade × Classe a partir de 9) e pictogramas SVG por disciplina, no admin (Inscrições, Chaveamento) e na página pública do torneio | ✅ `components/shared/category-picker.tsx`, `discipline-icon.tsx` |
| Amistoso com jogadores avulsos (sem cadastro): lista colada por categoria, planilha amistosa, pareamento pelo nome entre categorias | ✅ `athletes.guest` (migration `0014`), `POST /tournaments/categories/:id/guests`, regra em `domain/guest-list.ts`. Página de partidas do jogador com a busca "Encontre sua próxima partida" no torneio (`/t/[slug]/jogador/[athleteId]`, bye e próxima se vencer) ✅; a página também abre pelos nomes em Inscritos, pelo bloco "Próximas partidas" do perfil do atleta (que mostra as partidas a jogar no próprio perfil) e por "Ver partidas" no admin ✅. Juntar avulso com atleta cadastrado (`POST /athletes/:id/merge`, aba Avulsos em Atletas) ✅. Avulso ligado à federação (`guest_tenant_id`, migration `0015`) ✅ |

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
| PIN de admin para a rede local | ✅ | `ADMIN_PIN` na API: escrita só com sessão aberta pelo PIN (12 h, token no navegador), bloqueio de 1 min após 5 erros, modo admin global desligado. Cobre o uso em rede local até o Clerk. Testes: unitários e HTTP (Fastify inject) na API; o fluxo no navegador foi verificado à mão, porque o E2E roda sem PIN |
| Autenticação (Better Auth), papéis e seletor de tenant | ❌ | Fase 6 do plano online. Sem ela e sem `ADMIN_PIN`, nenhuma escrita é possível em produção |
| Versão online (Vercel, Render, Neon) | 🟡 | Plano aprovado em `docs/PLANO_ONLINE.md`. Feitas: fase 0 (decisões), 1a (minimização de dados) 1 (endurecimento: config de produção, CORS por lista, rate limit, trustProxy, /health, cabeçalhos, seed protegido) e 2 (sessão do PIN assinada, sobrevive a reinício). Fase 3: código pronto (workflow de deploy, passo a passo em `docs/PRODUCAO.md`); falta o usuário criar as contas Neon, Render e Vercel. Próximas: 4 a 7 |

## Phase 1 — Atletas, clubes e duplas

| Item | Situação | Observação |
|---|---|---|
| CRUD de atletas | ✅ | Soft delete. Só nome, gênero, ano de nascimento (opcional), nacionalidade e clube: sem e-mail nem data completa (minimização para a versão online, migration 0013) |
| Importação em lote por CSV | ✅ | Prévia e relatório de erros |
| CRUD de clubes | ✅ | Soft delete, slug único |
| Afiliações atleta ↔ clube | ✅ | Um clube ativo por vez |
| Gestão de duplas | ✅ | `/admin/pairs` |
| Perfil público do atleta (`/a/[athleteId]`) | ✅ | Sem dados pessoais |
| Página pública do clube (`/c/[clubSlug]`) | ✅ | |

## Phase 2 — Torneios, categorias e inscrições

| Item | Situação | Observação |
|---|---|---|
| CRUD de torneios | ✅ | `level` como enum; criação pela tela (botão "Novo torneio") |
| Importar torneio por planilha (.xlsx/.csv) | ✅ | Modelo para baixar; cria categorias, atletas, clubes, duplas e inscrições; verificação antes de gravar; lê também a planilha consolidada das federações (Mod/cat., uma aba por torneio) |
| Torneio amistoso | ✅ | `kind = friendly`: guarda tudo, não pontua; pode virar oficial depois |
| Ciclo de vida validado no servidor | ✅ | Transição, encerramento com pódio e reabertura que reverte pontos |
| Categorias com disciplina e formato | ✅ | |
| Inscrições com status (pendente, aprovada, recusada) | ✅ | Atleta XOR dupla; só aprovadas entram na chave. Aprovar, recusar com motivo, reabrir e remover na aba Inscrições |
| Check-in dos atletas no dia | ✅ | Botão "Presente" na aba Inscrições com contagem; `POST/DELETE /registrations/:id/check-in`; a fila do operador mostra quem confirmou. Spec `check-in.spec.ts` |
| Auditoria de aprovação e recusa (quem e quando) | ❌ | Depende de identidade de usuário (Clerk); hoje só `notes` e `updatedAt`. Contrato em `docs/api/tournament-registrations.md` |
| Editar inscrição (remanejar, trocar parceiro(a), substituir atleta, cabeça de chave e clube) | ✅ | Lápis na aba Inscrições; amistoso é quase todo editável (inclusive trocar atleta na chave); oficial segue as regras de elegibilidade |
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
| Critérios de desempate | ✅ | Pontos, títulos, 2º, 3º, melhor resultado, menos torneios, id (`domain/ranking-order.ts`, com testes); posições sempre distintas |
| Cache do ranking | ❌ | Fora do plano até haver lentidão medida (sem Redis) |

## Phase 4 — Chaves

| Item | Situação | Observação |
|---|---|---|
| Eliminação simples, sorteio aleatório e com cabeças de chave | ✅ | Gerador em `apps/api/src/domain/bracket.ts` |
| Byes como W.O. na primeira fase | ✅ | |
| Publicação com bloqueio de ressorteio | ✅ | `409 DRAW_PUBLISHED` |
| Ressorteio com reset em cascata | ✅ | |
| Todos contra todos (round robin) | ✅ | Formato por categoria; classificação com desempate, colocação pela classificação, `GET /draws/:drawId/standings` |
| Grupos + eliminatória | ✅ | Grupos, pessoas por grupo e classificados configuráveis; eliminatória gerada ao fim dos grupos; migration `0006` |
| Suíço | ✅ | Rodadas configuráveis, geradas uma a uma, pareamento sem repetir, folga, Buchholz; migration `0007` |
| Eliminação dupla | ✅ | Chave dos vencedores e dos perdedores, grande final com reset configurável; migration `0008` |

## Phase 5 — Partidas

| Item | Situação | Observação |
|---|---|---|
| Lançamento de resultado por sets | ✅ | Inclui W.O. e desistência |
| Avanço automático do vencedor | ✅ | Troca de vencedor desfaz as partidas seguintes |
| Agenda: quadra e horário por partida | ✅ | Aba Agenda do torneio |
| Agenda automática por quadra e horário | ✅ | `POST /tournaments/:id/schedule/auto` com pré-visualização; sem mudança de schema; a janela diária (`dayStartsAt`, `dayEndsAt`) tem campos "Início do dia" e "Fim do dia" no diálogo |
| Auditoria de resultados (quem e quando) | 🟡 | "Quando" e "o quê" feitos: histórico de cada gravação (antes, depois, origem, quadra, cascata) em `match_result_events`, no diálogo de resultado. "Quem" depende de identidade (Clerk). Spec `result-history.spec.ts` |
| Placar ao vivo por quadra | ✅ | Tela do operador `/admin/live`, API de início, ponto, desfazer e encerramento, stream SSE público e seção "Ao vivo agora" em `/t/[slug]`. Barramento em memória: uma instância de API (ver especificação) |
| Telão do torneio (TV ou projetor) | ✅ | `/telao/[slug]`: quadras com placar ao vivo ou próxima partida, fila das próximas 8, relógio e tela cheia. Spec `telao.spec.ts` e rota no spec WCAG |
| QR code do público e súmulas impressas | ✅ | QR da página do torneio no telão (`qrcode`); `/t/[slug]/sumulas` com uma súmula por partida pronta. Spec `sumulas.spec.ts` |

## Phase 6 — Portal público

| Item | Situação |
|---|---|
| Landing, torneio, rankings, atleta e clube | ✅ |
| Busca pública de atletas (`GET /athletes/search`) | ✅ |
| Imagens de compartilhamento (Open Graph 1200x630 e "story" 1080x1350 do pódio) | ✅ |
| Compartilhar e baixar imagem (torneio, atleta e ranking) | ✅ |
| Impressão / PDF da chave e do ranking (`@media print`) | ✅ |
| Estatísticas e histórico de atletas | ✅ |
| Head-to-head | ✅ |

## Phase 7 — Admin

| Item | Situação | Observação |
|---|---|---|
| Dashboard com dados reais | ✅ | |
| Relatórios exportáveis | ✅ | CSV de inscritos, entradas do ranking, resultados das partidas, agenda, classificação final, lista de atletas e atletas do clube (os dois últimos de admin) |
| Notificações | ❌ | Dependem de provedor de e-mail/WhatsApp e de login |
| Gestão de usuários e papéis | ❌ | Depende da identidade (Better Auth, Fase 6) |

## Phase 8 — Qualidade e mobile

| Item | Situação | Observação |
|---|---|---|
| Backup e restauração do banco | ✅ | `pnpm db:backup` e `pnpm db:restore <arquivo> --yes` pelo contêiner; restauração com backup automático antes e em transação única. Sem botão no admin: a API não tem acesso ao `pg_dump` |
| Testes unitários de domínio (Vitest) | ✅ | |
| Testes E2E com Playwright | ✅ | `apps/e2e`, `pnpm e2e`, job `e2e` no CI. Cobre: portal público (home, busca, perfil, torneio encerrado com campeão, ranking e CSV, compartilhar, 404), ciclo de vida do torneio no admin, inscrições pela interface (inscrever, aprovar, recusar com motivo, reabrir, remover), cadastros (atletas, importação de CSV, clubes, duplas), rankings e regras de pontos no admin (criar, regra, vincular, recalcular, editar), relatórios CSV, agenda automática, placar ao vivo com SSE, tema, guard de modo admin e a auditoria de acessibilidade (axe, teclado e foco) |
| PWA (instalável, página sem conexão) | ✅ | Manifesto, ícones, service worker mínimo; instalar exige HTTPS ou localhost |
| Push notifications | ❌ | Exigem HTTPS, VAPID, assinaturas no banco e disparador; entram com a build online |
| Acessibilidade WCAG 2.1 AA | 🟡 | Auditoria automática com axe (WCAG A e AA) em 25 rotas e estados, em tema claro e escuro, em desktop e celular, mais 23 overlays abertos (diálogos, sheets, menus), e testes dirigidos de teclado, foco preso e devolvido, Escape, skip link, reflow, alvos de toque, movimento reduzido e `aria-live` (`apps/e2e/tests/wcag*.spec.ts`). Antes das correções o axe achou 185 grupos de violação (366 nós), sobretudo `color-contrast`, `button-name`, `label` e `select-name`; todos corrigidos, com 3 exceções documentadas em `ALLOWED_VIOLATIONS`. Impressão (`@media print`) passa pelo axe e as imagens de compartilhamento têm checagem de PNG (`wcag-print.spec.ts`). Pendente só a passada manual com leitor de tela (o axe cobre cerca de um terço dos critérios), que não dá para automatizar; roteiro em `docs/ACESSIBILIDADE_LEITOR_DE_TELA.md` |

## Dívidas técnicas

| Item | Prioridade | Detalhe |
|---|---|---|
| Revisões por LLM do `security-guidance` desligadas | Baixa | `ENABLE_CODE_SECURITY_REVIEW=0` em `.claude/settings.json` para não gastar uso enquanto o projeto roda só localmente; só os avisos por padrão ficam ativos. Religar (apagar a variável) antes de colocar o projeto na internet |
