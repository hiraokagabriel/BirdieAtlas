# BirdieAtlas - Plataforma de Gestao de Campeonatos de Badminton

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

### Frontend

- **Next.js 15** com App Router (SSR/SSG/ISR)
- **TypeScript** strict mode
- **Tailwind CSS v4**
- **Shadcn/ui** para componentes
- **TanStack Query v5** para cache
- **Zod** para validacao

### Backend

- **Node.js + Fastify** (REST API)
- **TypeScript** strict mode
- **Drizzle ORM** com PostgreSQL
- **Zod** para validacao de inputs

### Banco de Dados

- **PostgreSQL** (Docker local, Railway em prod)
- Drizzle Kit para migrations

### Infraestrutura

- **Vercel** (frontend)
- **Railway** (backend + DB)
- **Clerk** (auth)
- **Cloudinary** (uploads)
- **Resend** (emails)
- **Sentry** (error tracking)

---

## Arquitetura

### Monorepo

```
BirdieAtlas/
├── apps/
│   ├── web/          # Next.js 15
│   └── api/          # Fastify + Drizzle
├── packages/
│   ├── types/        # Tipos compartilhados
│   ├── validators/   # Schemas Zod
│   └── config/       # eslint, tsconfig
└── docs/             # Documentacao
```

---

## Modelagem de Dados

### Entidades Principais

- **Tenant** - Federacao/organizacao
- **Club** - Clube com atletas
- **Athlete** - Atleta com perfil
- **AthleteAffiliation** - Historico atleta-clube
- **Tournament** - Campeonato
- **TournamentCategory** - Disciplina (MS, WS, MD, WD, XD)
- **TournamentRegistration** - Inscricao
- **Draw** - Chave gerada
- **Match** - Partida
- **MatchResult** - Sets de um confronto
- **Ranking** - Ranking de uma disciplina
- **RankingEntry** - Posicao e pontos
- **PointsTable** - Tabela de pontos

---

## Roadmap

### Phase 0 - Fundacao 🔄
- Monorepo, CI/CD, auth, banco, config

### Phase 1 - Atletas e Clubes 🔄
- CRUD, importacao, perfis publicos

### Phase 2 - Torneios e Inscricoes 🔄
- CRUD, categorias, inscricoes, pagina publica

### Phase 3 - Motor de Ranking ⏳
- Calculo automatico, cache, pagina publica

### Phase 4 - Chaves ⏳
- Seed, todos formatos, chave publica

### Phase 5 - Partidas ⏳
- Lancamento de placar, progressao, auditoria

### Phase 6 - Portal Publico ⏳
- Resultados ao vivo, stats, head-to-head

### Phase 7 - Dashboard Admin ⏳
- KPIs, relatorios, notificacoes

### Phase 8 - Mobile ⏳
- PWA, push, testes E2E, polish

---

## Proximos Passos

1. **Phase 0:** Finalizar auth com Clerk
2. **Phase 1:** CRUD de atletas e clubes
3. **Phase 2:** Torneios e inscricoes
4. **Phase 3+:** Sequencia natural

---

**Documentacao completa:** `docs/ESPECIFICACAO_COMPLETA.md` (na branch de desenvolvimento)

**Ultima atualizacao:** 27/08/2026
