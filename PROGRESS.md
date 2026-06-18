# BirdieAtlas — Progresso do Projeto

> Última atualização: **18/06/2026**  
> Branch ativa: `feat/phase-2-3-completion`

---

## ✅ Phase 0 — Infraestrutura Base

| Item | Status | Observação |
|---|---|---|
| Monorepo Turborepo (`apps/web`, `apps/api`) | ✅ Feito | |
| TypeScript strict em todos os pacotes | ✅ Feito | |
| Docker Compose para PostgreSQL local | ✅ Feito | Porta 5432, db `birdie_atlas` |
| Drizzle ORM + drizzle-kit configurados | ✅ Feito | Versões fixadas: `drizzle-orm@0.41.0`, `drizzle-kit@0.30.6` |
| Schema centralizado em `apps/api/src/db/schema.ts` | ✅ Feito | |
| GitHub Actions — typecheck automático (tsc --noEmit) | ✅ Feito | Roda em push/PR para main |
| `.env.example` documentado | ✅ Feito | Inclui `DEV_ADMIN_MODE` |
| **Clerk Auth** | ❌ Pendente | Phase 0 ainda aberta — sem middleware de autenticação real |
| Roles e middleware de autorização | ❌ Pendente | Depende do Clerk |

---

## ✅ Phase 1 — Atletas, Clubes e Importação

| Item | Status | Observação |
|---|---|---|
| CRUD de atletas (API + UI) | ✅ Feito | |
| Modal "Novo Atleta" | ✅ Feito | |
| Importação em lote via CSV | ✅ Feito | Preview + relatório de erros |
| CRUD de clubes (API + UI) | ✅ Feito | |
| Modal "Novo Clube" e "Editar Clube" | ✅ Feito | |
| Afiliações atleta ↔ clube (`athlete_affiliations`) | ✅ Feito | Schema OK |
| Filtro de gênero por disciplina nas inscrições | ✅ Feito | |
| **Perfil público do atleta** (`/a/[athleteId]`) | ❌ Pendente | Rota planejada, não implementada |
| **Página pública de clube** | ❌ Pendente | Sem rota pública |
| **Gestão dedicada de duplas** | ❌ Pendente | `athlete2Id` existe nas inscrições mas sem modelo/UI dedicado |

---

## ✅ Phase 2 — Torneios, Categorias e Inscrições

| Item | Status | Observação |
|---|---|---|
| CRUD de torneios (API + UI) | ✅ Feito | |
| Busca de torneio por slug | ✅ Feito | `GET /tournaments/by-slug/:slug` |
| Categorias de torneio com disciplina e formato | ✅ Feito | |
| Sistema de inscrições com aba no dashboard | ✅ Feito | |
| Geração de chave — modo aleatório | ✅ Feito | |
| Geração de chave — com cabeças-de-chave (seeded) | ✅ Feito | |
| Ressortear chave com reset em cascata | ✅ Feito | |
| Encerramento de torneio com relatório de pódio | ✅ Feito | |
| Reabertura de torneio (reverte pontos) | ✅ Feito | |
| Tabela de pontos — editor inline e bulk update | ✅ Feito | |
| Atribuição de pontos (`award-points`) | ✅ Feito | Trata byes, walkover, retired |
| W.O. contabiliza como 21-0 para o vencedor | ✅ Feito | Motor lê sets salvos, nunca assume slot 1 |
| Ret. usa parciais com vencedor fazendo 21 | ✅ Feito | Mesmo mecanismo de resolução por sets |
| UI de lançamento de resultado (W.O./Ret.) com validação | ✅ Feito | Banner explicativo + erro se vencedor não selecionado |
| Página de setup do torneio (aba Configurações) | ✅ Feito | |
| **Página pública do torneio** (`/t/[slug]`) | ✅ Feito | `page.tsx` implementado em `apps/web/src/app/(public)/t/[slug]/` |
| **Publicação de chave com bloqueio de edição** | ❌ Pendente | Campo `published` existe no schema, sem fluxo real |
| **Schedule view (quadra/horário por partida)** | ❌ Pendente | Componente parcial, agendamento não finalizado |

---

## 🔄 Phase 3 — Motor de Ranking

| Item | Status | Observação |
|---|---|---|
| Schema robusto de rankings no banco | ✅ Feito | `rankings`, `pointRules`, `rankingTournaments`, `rankingEntries` |
| Campo `finalPlacement` em `tournament_registrations` | ✅ Feito | Motor lê este campo |
| Motor de recálculo (`recalculateRanking`) | ✅ Feito | `POST /rankings/:id/recalculate` |
| Tratamento de byes no motor | ✅ Feito | |
| Vínculo `rankingTournament` criado ao atribuir pontos | ✅ Feito | `award-points` cria o link automaticamente |
| `totalPoints` como única coluna de pontuação | ✅ Feito | Coluna legada `points` removida do schema em 11/06/2026 |
| CRUD de `PointRules` (API + UI) | ✅ Feito | Rotas + `point-rules-manager.tsx` na aba de rankings |
| `rankings.slug` com default vazio | ✅ Feito | **Preencher via Drizzle Studio** (`pnpm --filter api db:studio`) |
| `tournaments.level` como `text` | ✅ Feito | Migrar para enum em migration formal futura |
| **`PointRules` integrado ao motor `recalculateRanking`** | ✅ Feito | `resolvePointsFromRules()` — tenta regra específica (nível+disciplina), depois genérica (só nível), cai no `pointsTables` legado apenas se não houver regra |
| **`countBestResults` aplicado no motor** | ✅ Feito | `allResults.sort(...).slice(0, countBestResults)` — aplica antes de somar `totalPoints` |
| **`minTournamentsRequired` aplicado no motor** | ✅ Feito | Filtra atletas com `tournamentsCount < minTournamentsRequired` antes de gerar entries |
| **Página de ranking no dashboard** (`/rankings`) | ✅ Feito | Lista com badges de `countBestResults`/`minTournamentsRequired`; detalhe com banner de regras ativas, expansão de resultados por torneio e aba de PointRules |
| **Página pública de ranking** (`/r/[tenantSlug]`) | ✅ Feito | `page.tsx` implementado em `apps/web/src/app/(public)/r/[tenantSlug]/` |
| **Cache Redis para rankings** (TTL 1h) | ❌ Pendente | Planejado para fase posterior |

---

## ❌ Phase 4 — Formatos de Chave

| Item | Status |
|---|---|
| Double elimination | ❌ Planejado |
| Round Robin | ❌ Planejado |
| Grupos + eliminatória | ❌ Planejado |
| Seed com todos os formatos | ❌ Planejado |

---

## ❌ Phase 5 — Partidas ao Vivo

| Item | Status |
|---|---|
| Lançamento de placar por partida | ❌ Planejado |
| Progressão automática na chave após resultado | ❌ Planejado |
| Auditoria de resultados (quem lançou, quando) | ❌ Planejado |

---

## ❌ Phase 6 — Portal Público

| Item | Status |
|---|---|
| Página pública do torneio (`/t/[slug]`) | ✅ Feito |
| Página pública de ranking (`/r/[tenantSlug]`) | ✅ Feito |
| Perfil público do atleta (`/a/[athleteId]`) | ❌ Planejado |
| Resultados ao vivo | ❌ Planejado |
| Stats de atletas (histórico, evolução de ranking) | ❌ Planejado |

---

## ❌ Phase 7 — Dashboard Admin

| Item | Status |
|---|---|
| Relatórios exportáveis (PDF/CSV) | ❌ Planejado |
| Notificações internas | ❌ Planejado |
| Gestão de usuários e roles (pós-Clerk) | ❌ Planejado |

---

## ❌ Phase 8 — Mobile / PWA

| Item | Status |
|---|---|
| PWA com service worker | ❌ Planejado |
| Push notifications | ❌ Planejado |
| Testes E2E com Playwright | ❌ Planejado |

---

## 🛠️ Dívidas Técnicas Abertas

| Item | Prioridade | Detalhe |
|---|---|---|
| Preencher `rankings.slug` nos registros existentes | 🔴 Alta | Rodar `pnpm --filter api db:studio` e preencher manualmente |
| Rodar `pnpm --filter api db:push` para aplicar remoção de `points` | 🔴 Alta | Schema atualizado em 11/06, banco ainda tem a coluna |
| Migrar `tournaments.level` de `text` para `tournamentLevelEnum` | 🟡 Média | Requer migration formal com `ALTER COLUMN ... USING` |
| Fixar versões de `fastify`, `pg`, `zod`, `tsx` no `package.json` | 🟡 Média | Atualmente em `latest` — risco de quebra em `pnpm install` futuro |
| Abrir PR da branch `feat/phase-2-3-completion` → `main` | 🟡 Média | Branch nunca foi mergeada |

---

## 🔧 Sistema de Modo Admin (Dev)

Implementado em **09/06/2026** enquanto o Clerk não está integrado.

- **Ligar/desligar pelo botão**: aparece no canto inferior direito do dashboard (só em `NODE_ENV=development`)
- **Ligar via `.env`**: `DEV_ADMIN_MODE=true` em `apps/api/.env`
- **Ligar via API**: `PATCH http://localhost:3001/dev/admin-mode { "enabled": true }`
- **Proteger uma rota**: `{ preHandler: requireAdmin }` importado de `apps/api/src/middleware/admin-guard.ts`
- Em produção: a rota `/dev/admin-mode` **não é registrada** automaticamente
