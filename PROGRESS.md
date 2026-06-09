# BirdieAtlas — Progresso do Projeto

> Última atualização: **09/06/2026**  
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
| Página de setup do torneio (aba Configurações) | ✅ Feito | |
| **Página pública do torneio** (`/t/[slug]`) | ❌ Pendente | Rota planejada, não implementada |
| **Publicação de chave com bloqueio de edição** | ❌ Pendente | Campo `published` existe no schema, sem fluxo real |
| **Schedule view (quadra/horário por partida)** | ❌ Pendente | Componente parcial, agendamento não finalizado |

---

## 🔄 Phase 3 — Motor de Ranking

| Item | Status | Observação |
|---|---|---|
| Schema robusto de rankings no banco | ✅ Feito | `rankings`, `pointRules`, `rankingTournaments`, `rankingEntries` |
| Campo `finalPlacement` em `tournament_registrations` | ✅ Feito | Motor lê este campo |
| Campos novos em `rankingEntries` | ✅ Feito | `totalPoints`, `resultsDetail`, `previousPosition`, `manualAdjustment`, auditoria |
| Motor de recálculo (`recalculateRanking`) | ✅ Feito | Rota `POST /rankings/:id/recalculate` |
| Tratamento de byes no motor | ✅ Feito | |
| Coluna legada `points` preservada | ✅ Feito | Ao lado de `totalPoints` — remover após migração manual |
| `rankings.slug` com default vazio | ✅ Feito | **Preencher via Drizzle Studio** (`pnpm --filter api db:studio`) |
| `tournaments.level` como `text` | ✅ Feito | Migrar para enum em migration formal futura |
| **`PointRules` granulares por nível/disciplina** | ❌ Pendente | Tabela criada no schema, sem rotas CRUD e sem UI |
| **Página de ranking no dashboard** | ❌ Pendente | Rota `/rankings` existe mas sem uso das novas features |
| **Página pública de ranking** (`/r/[tenantSlug]`) | ❌ Pendente | Planejada, não implementada |
| **`countBestResults` aplicado no motor** | ❌ Pendente | Campo existe, lógica de "N melhores" não implementada no motor |
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
| Lógica de walkover / W.O. na UI | ❌ Planejado |

---

## ❌ Phase 6 — Portal Público

| Item | Status |
|---|---|
| Página pública do torneio (`/t/[slug]`) | ❌ Planejado |
| Página pública de ranking (`/r/[tenantSlug]`) | ❌ Planejado |
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
| Preencher `rankings.slug` nos 5 registros existentes | 🔴 Alta | Rodar `pnpm --filter api db:studio` e preencher manualmente |
| Migrar `rankingEntries.points` → `totalPoints` | 🟡 Média | `UPDATE ranking_entries SET total_points = points WHERE total_points = 0` |
| Migrar `tournaments.level` de `text` para `tournamentLevelEnum` | 🟡 Média | Requer migration formal com `ALTER COLUMN ... USING` |
| Fixar versões de `fastify`, `pg`, `zod`, `tsx` no `package.json` | 🟡 Média | Atualmente em `latest` — risco de quebra em `pnpm install` futuro |
| Remover coluna legada `points` de `ranking_entries` | 🟢 Baixa | Só após migração dos dados |

---

## 🔧 Sistema de Modo Admin (Dev)

Implementado em **09/06/2026** enquanto o Clerk não está integrado.

- **Ligar/desligar pelo botão**: aparece no canto inferior direito do dashboard (só em `NODE_ENV=development`)
- **Ligar via `.env`**: `DEV_ADMIN_MODE=true` em `apps/api/.env`
- **Ligar via API**: `PATCH http://localhost:3001/dev/admin-mode { "enabled": true }`
- **Proteger uma rota**: `{ preHandler: requireAdmin }` importado de `apps/api/src/middleware/admin-guard.ts`
- Em produção: a rota `/dev/admin-mode` **não é registrada** automaticamente
