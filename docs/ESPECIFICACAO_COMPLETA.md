# BirdieAtlas - Especificacao Completa do Projeto

## Visao Geral

**BirdieAtlas** e uma plataforma web full-stack para gestao de campeonatos de badminton, focada em federacoes e organizacoes esportivas.

### Objetivos Principais

1. Gerenciar atletas, clubes e afiliacoes
2. Organizar torneios com inscricoes e categorias
3. Gerar chaves de competicao (draws) em multiplos formatos
4. Calcular rankings automaticamente baseado em resultados
5. Disponibilizar portal publico com resultados e estatisticas

---

## Stack Tecnologica

### Frontend (apps/web)

- **Next.js 15** com App Router (SSR/SSG/ISR)
- **TypeScript** strict mode obrigatorio
- **Tailwind CSS v4** para estilizacao
- **Shadcn/ui** para componentes base
- **TanStack Query v5** para cache e estado servidor
- **Zod** para validacao de schemas no cliente

### Backend (apps/api)

- **Node.js + Fastify** (REST API)
- **TypeScript** strict mode obrigatorio
- **Drizzle ORM** com PostgreSQL
- **Zod** para validacao de input em todos os endpoints
- Sem BullMQ por enquanto (filas em fases posteriores)

### Banco de Dados

- **PostgreSQL** (local via Docker porta 5432, db birdie_atlas)
- Drizzle Kit para migrations
- Dev: `db:push` para sincronizar schema
- Prod: `db:generate` → `db:migrate`

### Autenticacao

- **Clerk** (ainda nao integrado - Phase 0)
- Roles planejadas:
  - `federation_admin`
  - `tournament_organizer`
  - `referee`
  - `club_manager`
  - `athlete`
  - `public`

### Infraestrutura Planejada

- **Vercel** (frontend)
- **Railway** (backend + banco)
- **Cloudinary/Uploadthing** para uploads
- **Resend** para emails transacionais
- **Sentry** para error tracking
- **Playwright** para testes E2E

---

## Arquitetura do Sistema

### Monorepo

```
BirdieAtlas/
├── apps/
│   ├── web/          # Next.js 15
│   └── api/          # Fastify + Drizzle
├── packages/
│   ├── types/        # Tipos compartilhados
│   ├── validators/   # Schemas Zod compartilhados
│   └── config/       # eslint, tsconfig
├── docs/             # Documentacao
└── docker-compose.yml
```

### Estrutura de Pastas

#### Frontend (apps/web)

```
src/
├── app/
│   ├── (dashboard)/          # Painel admin (sem auth por enquanto)
│   │   ├── layout.tsx        # Sidebar + header
│   │   ├── dashboard/        # KPIs e visao geral
│   │   ├── athletes/         # Listagem e detalhe de atletas
│   │   ├── clubs/            # Listagem e detalhe de clubes
│   │   ├── tournaments/      # Listagem e detalhe de torneios
│   │   └── rankings/         # Listagem de rankings + /[rankingId]
│   └── (public)/             # Rotas publicas sem auth
│       ├── layout.tsx
│       ├── a/[athleteId]/    # Perfil publico do atleta
│       ├── r/[tenantSlug]/   # Pagina publica de rankings
│       └── t/[slug]/         # Pagina publica do torneio
├── components/
│   ├── ui/                   # Re-exports do shadcn/ui
│   └── shared/               # Componentes compartilhados
├── hooks/                    # Custom hooks
└── lib/
    ├── api.ts                # Cliente HTTP (apiFetch)
    └── utils.ts
```

#### Backend (apps/api)

```
src/
├── db/
│   ├── index.ts              # Instancia do Drizzle (db)
│   └── schema.ts             # Schema completo (fonte da verdade)
├── routes/
│   ├── athletes.ts
│   ├── clubs.ts
│   ├── tournaments.ts
│   ├── draws.ts
│   ├── matches.ts
│   ├── rankings.ts
│   └── award-points.ts
└── index.ts                  # Bootstrap do Fastify
```

---

## Modelagem de Dados

### Entidades Principais

#### Tenant
```
- id: text (PK)
- name: text
- slug: text (unique)
- branding: jsonb
- createdAt: timestamp
- updatedAt: timestamp
```

#### Club
```
- id: text (PK)
- tenantId: text (FK -> Tenant)
- name: text
- shortName: text
- logoUrl: text
- city: text
- state: text
- createdAt: timestamp
- updatedAt: timestamp
- deletedAt: timestamp (soft delete)
```

#### Athlete
```
- id: text (PK)
- tenantId: text (FK -> Tenant)
- name: text
- gender: text (M, F, U)
- birthDate: date
- currentClubId: text (FK -> Club)
- createdAt: timestamp
- updatedAt: timestamp
- deletedAt: timestamp
```

#### AthleteAffiliation
```
- id: text (PK)
- athleteId: text (FK -> Athlete)
- clubId: text (FK -> Club)
- startDate: date
- endDate: date (null = ativo)
- createdAt: timestamp
- updatedAt: timestamp
```

#### Tournament
```
- id: text (PK)
- tenantId: text (FK -> Tenant)
- name: text
- slug: text (unique)
- level: text (INTERNATIONAL, NATIONAL, STATE, REGIONAL, LOCAL)
- startDate: date
- endDate: date
- status: text (DRAFT, PUBLISHED, IN_PROGRESS, COMPLETED, CANCELLED)
- pointsTableId: text (FK -> PointsTable)
- createdAt: timestamp
- updatedAt: timestamp
```

#### TournamentCategory
```
- id: text (PK)
- tournamentId: text (FK -> Tournament)
- name: text (MS, WS, MD, WD, XD)
- discipline: text (MENS_SINGLES, WOMENS_SINGLES, etc.)
- minRating: integer
- maxRating: integer
- ageGroup: text (U11, U13, U15, U17, U19, OPEN, SENIOR)
- status: text (DRAFT, OPEN, CLOSED, IN_PROGRESS, COMPLETED)
- drawGenerated: boolean
- createdAt: timestamp
- updatedAt: timestamp
```

#### TournamentRegistration
```
- id: text (PK)
- tournamentId: text (FK -> Tournament)
- categoryId: text (FK -> TournamentCategory)
- athleteId: text (FK -> Athlete)
- pairId: text (FK -> Athlete, opcional para duplas)
- status: text (PENDING, APPROVED, REJECTED)
- notes: text
- seed: integer
- createdAt: timestamp
- updatedAt: timestamp
```

#### Draw
```
- id: text (PK)
- categoryId: text (FK -> TournamentCategory)
- format: text (SINGLE_ELIMINATION, DOUBLE_ELIMINATION, ROUND_ROBIN, SWISS)
- seedMethod: text (MANUAL, RATING, RANDOM)
- status: text (DRAFT, PUBLISHED, IN_PROGRESS, COMPLETED)
- settings: jsonb
- createdAt: timestamp
- updatedAt: timestamp
```

#### Match
```
- id: text (PK)
- drawId: text (FK -> Draw)
- roundNumber: integer
- matchNumber: integer
- player1Id: text (FK -> Athlete)
- player2Id: text (FK -> Athlete)
- winnerId: text (FK -> Athlete, nullable)
- nextMatchId: text (FK -> Match, nullable)
- status: text (SCHEDULED, IN_PROGRESS, COMPLETED, WALKOVER)
- scheduledAt: timestamp
- createdAt: timestamp
- updatedAt: timestamp
```

#### MatchResult
```
- id: text (PK)
- matchId: text (FK -> Match, unique)
- set1Player1: integer
- set1Player2: integer
- set2Player1: integer
- set2Player2: integer
- set3Player1: integer (nullable)
- set3Player2: integer (nullable)
- winnerId: text (FK -> Athlete)
- createdAt: timestamp
- updatedAt: timestamp
```

#### Ranking
```
- id: text (PK)
- tenantId: text (FK -> Tenant)
- name: text
- discipline: text
- category: text (MS, WS, MD, WD, XD)
- ageGroup: text
- autoInclude: boolean
- published: boolean
- createdAt: timestamp
- updatedAt: timestamp
```

#### RankingTournament
```
- id: text (PK)
- rankingId: text (FK -> Ranking)
- tournamentId: text (FK -> Tournament)
- weight: decimal
- mandatory: boolean
- createdAt: timestamp
```

#### RankingEntry
```
- id: text (PK)
- rankingId: text (FK -> Ranking)
- athleteId: text (FK -> Athlete)
- pairId: text (FK -> Athlete, nullable)
- position: integer
- points: decimal
- tournamentsPlayed: integer
- createdAt: timestamp
- updatedAt: timestamp
```

#### PointsTable
```
- id: text (PK)
- tenantId: text (FK -> Tenant)
- name: text
- levels: jsonb  # { INTERNATIONAL: {...}, NATIONAL: {...}, ... }
- createdAt: timestamp
- updatedAt: timestamp
```

---

## API Endpoints Planejados

### Atletas

- `GET /api/athletes` - Listar atletas (com filtros e paginacao)
- `GET /api/athletes/:id` - Obter detalhes de um atleta
- `POST /api/athletes` - Criar novo atleta
- `PATCH /api/athletes/:id` - Atualizar atleta
- `DELETE /api/athletes/:id` - Remover atleta (soft delete)
- `GET /api/athletes/:id/affiliations` - Historico de afiliacoes
- `POST /api/athletes/:id/affiliations` - Adicionar afiliacao

### Clubes

- `GET /api/clubs` - Listar clubes
- `GET /api/clubs/:id` - Obter detalhes de um clube
- `POST /api/clubs` - Criar novo clube
- `PATCH /api/clubs/:id` - Atualizar clube
- `DELETE /api/clubs/:id` - Remover clube (soft delete)

### Torneios

- `GET /api/tournaments` - Listar torneios
- `GET /api/tournaments/:id` - Obter detalhes de um torneio
- `POST /api/tournaments` - Criar novo torneio
- `PATCH /api/tournaments/:id` - Atualizar torneio
- `DELETE /api/tournaments/:id` - Remover torneio
- `GET /api/tournaments/:id/categories` - Listar categorias
- `POST /api/tournaments/:id/categories` - Criar categoria
- `PATCH /api/tournaments/:id/categories/:categoryId` - Atualizar categoria
- `GET /api/tournaments/:id/registrations` - Listar inscricoes
- `POST /api/tournaments/:id/registrations` - Criar inscricao
- `PATCH /api/tournaments/:id/registrations/:registrationId` - Atualizar inscricao
- `POST /api/tournaments/:id/registrations/:registrationId/approve` - Aprovar inscricao

### Chaves (Draws)

- `POST /api/tournaments/:id/categories/:categoryId/draws/generate` - Gerar chave
- `GET /api/draws/:id` - Obter chave
- `PATCH /api/draws/:id` - Atualizar configuracoes da chave
- `GET /api/draws/:id/matches` - Listar partidas da chave

### Partidas (Matches)

- `PATCH /api/matches/:id` - Atualizar partida (agendamento, etc.)
- `POST /api/matches/:id/results` - Lancar resultado
- `PATCH /api/matches/:id/results` - Atualizar resultado
- `POST /api/matches/:id/advance` - Avanocar vencedor

### Rankings

- `GET /api/rankings` - Listar rankings
- `GET /api/rankings/:id` - Obter ranking com posicoes
- `POST /api/rankings` - Criar ranking
- `PATCH /api/rankings/:id` - Atualizar ranking
- `POST /api/rankings/:id/recalculate` - Recalcular ranking
- `GET /api/rankings/:id/entries` - Listar posicoes do ranking
- `POST /api/rankings/:id/tournaments` - Vincular torneio ao ranking

### Pontos (Award Points)

- `GET /api/award-points/tables` - Listar tabelas de pontos
- `POST /api/award-points/tables` - Criar tabela de pontos
- `PATCH /api/award-points/tables/:id` - Atualizar tabela

---

## Fluxos de Usuario

### 1. Cadastro de Atleta

1. Federation admin acessa `/athletes`
2. Clica em "+ Novo Atleta"
3. Preenche: nome, genero, data de nascimento, clube atual
4. Sistema cria atleta com afiliacao inicial
5. Atleta aparece na listagem

### 2. Inscricao em Torneio

1. Tournament organizer acessa `/tournaments/:id`
2. Clica em "Gerenciar Inscricoes"
3. Atleta ou dupla se inscreve em categoria
4. Inscricao fica com status `PENDING`
5. Organizer revisa e aprova/rejeita
6. Inscricao aprovada aparece na lista de participantes

### 3. Geracao de Chave

1. Organizer acessa categoria com minimo de inscricoes
2. Clica em "Gerar Chave"
3. Escolhe formato (eliminacao simples, dupla, etc.)
4. Escolhe metodo de seed (manual, rating, random)
5. Sistema gera chave com todas as partidas
6. Chave fica disponivel para publico

### 4. Lancamento de Resultados

1. Referee acessa partida em `/tournaments/:id/matches/:matchId`
2. Clica em "Lancar Resultado"
3. Insere sets (ex: 21-18, 19-21, 21-15)
4. Sistema valida resultado
5. Vencedor avanca automaticamente para proxima partida
6. Ranking e atualizado (se configurado)

### 5. Calculo de Ranking

1. Sistema calcula ranking automaticamente apos torneio
2. Ou federation admin aciona recalculo manual
3. Ranking considera:
   - Torneios vinculados ao ranking
   - Peso de cada torneio
   - Colocacao de cada atleta/dupla
   - Tabela de pontos da federacao
4. Ranking publicado automaticamente ou apos revisao

---

## Roadmap por Fases

### Phase 0 - Fundacao

- [x] Monorepo com Turborepo
- [x] CI/CD basico
- [x] Docker para banco local
- [x] Schema Drizzle inicial
- [x] Config base (eslint, tsconfig, tailwind)
- [ ] Auth com Clerk
- [ ] Variaveis de ambiente documentadas

**Status:** 🔄 Em andamento

### Phase 1 - Atletas e Clubes

- [ ] CRUD de atletas completo
- [ ] CRUD de clubes completo
- [ ] Afiliacoes (historico atleta-clube)
- [ ] Importacao em massa (CSV/Excel)
- [ ] Perfis publicos de atletas
- [ ] Busca e filtros avancados

**Status:** 🔄 Em andamento

### Phase 2 - Torneios e Inscricoes

- [ ] CRUD de torneios
- [ ] Categorias de torneio
- [ ] Sistema de inscricoes
- [ ] Aprovacao/rejeicao de inscricoes
- [ ] Pagina publica do torneio
- [ ] Lista de participantes publica

**Status:** 🔄 Em andamento

### Phase 3 - Motor de Ranking

- [ ] Modelos de ranking e entrada
- [ ] Calculadora de pontos
- [ ] Vinculo torneio-ranking
- [ ] Recalculo automatico
- [ ] Cache de rankings (Redis, TTL 1h)
- [ ] Pagina publica de rankings

**Status:** ⏳ Planejado

### Phase 4 - Geracao de Chaves

- [ ] Sistema de seed (manual, rating, random)
- [ ] Eliminacao simples
- [ ] Eliminacao dupla
- [ ] Round-robin (grupos)
- [ ] Sistema suico (Swiss)
- [ ] Chave publica visual

**Status:** ⏳ Planejado

### Phase 5 - Fluxo de Partidas

- [ ] Lancamento de placar
- [ ] Progressao automatica
- [ ] Walkover / desistencia
- [ ] Revisao de resultados
- [ ] Auditoria de alteracoes
- [ ] Historico de partidas

**Status:** ⏳ Planejado

### Phase 6 - Portal Publico

- [ ] Resultados ao vivo
- [ ] Estatisticas de atletas
- [ ] Historico de torneios
- [ ] Head-to-head
- [ ] Rankings por categoria
- [ ] RSS/feeds de resultados

**Status:** ⏳ Planejado

### Phase 7 - Dashboard Admin

- [ ] KPIs e metricas
- [ ] Relatorios personalizaveis
- [ ] Exportacao de dados
- [ ] Notificacoes por email
- [ ] Logs de auditoria
- [ ] Gestao de usuarios e permissoes

**Status:** ⏳ Planejado

### Phase 8 - Mobile e Polish

- [ ] PWA (instalavel)
- [ ] Push notifications
- [ ] Testes E2E completos
- [ ] Performance optimization
- [ ] Acessibilidade (WCAG)
- [ ] Documentacao de API

**Status:** ⏳ Planejado

---

## Criterios de Aceite

### Gerais

- [ ] TypeScript strict mode em todos os arquivos
- [ ] Sem `any` - usar `unknown` quando necessario
- [ ] Zod validation em todos os endpoints da API
- [ ] Testes unitarios para logica critica
- [ ] Componentes com menos de 150 linhas
- [ ] Sem prop drilling alem de 2 niveis

### Frontend

- [ ] Server Components por padrão (sem 'use client' desnecessario)
- [ ] TanStack Query para todo estado servidor
- [ ] Loading states e error states em todas as telas
- [ ] Responsive (mobile-first)
- [ ] next/image para todas as imagens
- [ ] Virtualizacao para listas > 100 itens

### Backend

- [ ] Validaçª£o com Zod antes de qualquer logica
- [ ] Respostas de erro padronizadas: `{ error: string, code?: string, details?: unknown }`
- [ ] Transaçª£o Drizzle para operaçªµes criticas
- [ ] Soft delete (`deletedAt`) para entidades de negocio
- [ ] Indices nas colunas de filtro/ordenacao
- [ ] Rate limiting (fase posterior)

### Banco de Dados

- [ ] Todo model tem `id`, `createdAt`, `updatedAt`
- [ ] Indices em FKs e colunas de busca frequente
- [ ] Constraints de integridade (unique, FK, check)
- [ ] Migrations versionadas e aplicaveis

---

## Comportamento Esperado

### Sistema

- **Offline-first:** Funciona parcialmente sem internet (cache)
- **Real-time:** Atualizaçªµes em tempo real via polling (WebSockets em fase posterior)
- **Auditavel:** Todo write tem log de quem/quando/oque
- **Seguro:** Dados sensiveis nunca expostos em endpoints publicos

### Usuario

- **Intuitivo:** Fluxos claros e objetivos
- **Rapido:** Carregamento < 3s em 3G
- **Confiavel:** Dados sempre consistentes
- **Acessivel:** WCAG 2.1 AA (fase 8)

---

## Regras de Negocio

### Atletas

- Atleta pode ter apenas um clube ativo por vez
- Afiliacoes sao historicas (nunca deletadas, apenas `endDate`)
- Genero: M (masculino), F (feminino), U (unificado/misto)

### Torneios

- Categorias tem limite de rating (min/max) opcional
- Inscricoes podem ser aprovadas/rejeitadas manualmente
- Torneio so pode gerar chave apos fechamento das inscricoes

### Chaves

- Seed define posicao inicial na chave
- Vencedor avanca automaticamente
- Perdedor em eliminacao dupla vai para chave de perdedores
- Walkover = vitoria sem disputa

### Rankings

- Ranking pode ser automatico (todos torneios) ou manual
- Torneios tem peso diferente no calculo
- Empate em pontos: criterios de desempate (head-to-head, sets, etc.)

---

## Seguranca e Auth

### Autenticaçª£o

- Clerk para gestao de usuarios
- Sessoes JWT com refresh automatico
- MFA opcional para admins

### Autorizaçª£o

- Roles checadas via middleware
- NUNCA inline no handler
- Cada endpoint verifica permissao necessaria

### Dados Sensiveis

- NUNCA expor: CPF, email, telefone em endpoints publicos
- Logs sem dados pessoais
- Rate limiting por IP/user (fase posterior)

---

## Infraestrutura

### Desenvolvimento

```
Docker (PostgreSQL local)
├── Porta 5432
└── DB: birdie_atlas

pnpm install
pnpm --filter api db:push
pnpm --filter web dev
pnpm --filter api dev
```

### Produçª£o

```
Vercel (Frontend)
├── SSR/SSG/ISR
├── Edge Functions
└── CDN global

Railway (Backend + DB)
├── Fastify API
├── PostgreSQL gerenciado
└── Redis (cache)

Cloudinary/Uploadthing
└── Upload de imagens/logos

Resend
└── Emails transacionais

Sentry
└── Error tracking
```

---

## Proximos Passos Imediatos

1. **Phase 0:** Finalizar auth com Clerk
2. **Phase 1:** CRUD de atletas e clubes funcional
3. **Phase 2:** Torneios e inscricoes
4. **Phase 3:** Motor de ranking
5. **Phase 4-8:** Sequencia natural

---

## Notas

- Este documento e a fonte da verdade para o projeto
- Qualquer mudanca significativa deve ser refletida aqui
- Manter atualizado a cada fase concluida

**Ultima atualizaçª£o:** 27/08/2026  
**Versao:** 1.0.0  
**Branch:** `feat/phase-2-registration-operations`
