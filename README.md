<div align="center">

<img src=".github/assets/logo.svg" alt="BirdieAtlas" width="80" />

# BirdieAtlas

**Full-stack web platform for badminton tournament management.**

Tournament creation · Ranking-based bracket generation · Athlete profiles · Live results

[![License: MIT](https://img.shields.io/badge/License-MIT-01696f.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=white)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Roadmap](#roadmap)
- [Code Conventions](#code-conventions)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**BirdieAtlas** is a premium, multi-tenant badminton management platform that covers the full competitive lifecycle — from athlete registration and ranking to seeded bracket generation and live match scoring.

Inspired by the operational depth of Tournament Software and the athlete-centric experience of the BWF ecosystem, it combines both into a single, cohesive product built entirely on modern TypeScript.

The platform serves three audiences simultaneously:

- **Organizers & Federations** — create and manage tournaments, generate seeded brackets automatically, schedule matches by court, and control the full competitive lifecycle.
- **Athletes & Clubs** — register, build detailed profiles, track rankings across disciplines, and monitor long-term performance history.
- **Public & Fans** — access live draw results, real-time scores, rankings, and athlete profiles without an account.

---

## Features

### Tournament Management
- Multi-event tournaments with discipline and category separation (MS, WS, MD, WD, XD)
- Supported formats: single elimination, double elimination, round robin, groups + knockout, Swiss
- Court scheduling with minimum rest time and multi-event conflict detection
- Automatic bye distribution for non-power-of-2 draw sizes
- Public tournament page with live bracket, schedule and results

### Ranking Engine
- Separate rankings per discipline and category
- Configurable scoring window (e.g., best 10 results over 52 weeks)
- Point rules configurable by tournament level and phase
- Seed freeze at inscription close date
- Full historical ranking timeline per athlete and pair

### Bracket Generation
- Automatic seeded draw based on ranking at cutoff date
- Seeds 1 & 2 placed on opposite halves; seeds 3 & 4 in separate quadrants
- Recursive seed distribution following standard BWF logic
- Manual override for special cases

### Athlete & Club Management
- Unified athlete profile with photo, club, dominant hand and disciplines
- Long-term match history, titles, ranking evolution and frequent doubles partners
- Club profiles with rosters, tournament history and aggregated stats
- Bulk import via spreadsheet and public registration form

### Results & Live Experience
- Fast score entry with automatic bracket advancement
- Simultaneous update of bracket, group table, schedule and athlete stats
- Real-time updates via WebSockets
- Result audit trail for result changes

### Multi-Tenant Architecture
- Isolated data per organization (federation, league, club circuit)
- Each tenant has its own branding, ranking configuration and user roles
- Designed to scale from a single regional federation to a national multi-org platform

---

## Tech Stack

### Full-Stack TypeScript Monorepo (Turborepo)

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, Shadcn/ui |
| State & cache | TanStack Query v5 (React Query) |
| Backend | Node.js + Fastify, TypeScript strict |
| Validation | Zod (shared between frontend and backend) |
| ORM | Prisma |
| Database | PostgreSQL (primary), Redis (cache + queues) |
| Async queues | BullMQ |
| Auth | Clerk |
| Uploads | Cloudinary or Uploadthing |
| Email | Resend |
| Realtime | WebSockets (Pusher or Socket.io) |
| Error tracking | Sentry |
| E2E tests | Playwright |
| Monorepo | Turborepo |
| Deploy | Vercel (web) + Railway (api + database) |

---

## Monorepo Structure

```txt
birdie-atlas/
├── apps/
│   ├── web/                # Next.js 15 frontend (App Router)
│   └── api/                # Fastify backend (REST)
├── packages/
│   ├── types/              # Shared TypeScript types and interfaces
│   ├── validators/         # Shared Zod schemas
│   └── config/             # Shared ESLint, Prettier and tsconfig
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

### `apps/web`

```txt
src/
├── app/
│   ├── (public)/           # Public routes — no auth required
│   │   ├── page.tsx
│   │   ├── tournaments/[slug]/
│   │   ├── athletes/[slug]/
│   │   ├── clubs/[slug]/
│   │   └── rankings/
│   ├── (auth)/             # Authenticated athlete area
│   │   └── athlete/
│   ├── admin/              # Admin panel (federation_admin+)
│   │   ├── page.tsx
│   │   ├── tournaments/
│   │   ├── athletes/
│   │   ├── clubs/
│   │   ├── rankings/
│   │   ├── reports/
│   │   ├── users/
│   │   └── settings/
│   ├── referee/            # Referee interface (mobile-first)
│   └── layout.tsx
├── components/
│   ├── ui/                 # Shadcn/ui re-exports (do not edit)
│   ├── shared/             # Cross-module shared components
│   ├── athlete/
│   ├── bracket/
│   ├── ranking/
│   └── tournament/
├── hooks/                  # Custom hooks (useRanking, useBracket, etc.)
└── lib/
    ├── api.ts              # HTTP client
    └── utils.ts
```

### `apps/api`

```txt
src/
├── routes/
│   ├── athletes/           # routes + schema + handler
│   ├── clubs/
│   ├── tournaments/
│   ├── brackets/
│   ├── matches/
│   ├── rankings/
│   ├── admin/
│   └── push/
├── services/               # Business logic (isolated from handlers)
│   ├── ranking.service.ts
│   ├── bracket.service.ts
│   ├── match.service.ts
│   └── notification.service.ts
├── jobs/                   # BullMQ workers
├── middlewares/            # Auth, role guard, rate limit
├── plugins/                # Fastify plugins (Prisma, Redis, Auth)
└── utils/
```

### `packages/validators`

All Zod schemas shared between `apps/web` and `apps/api`. Never duplicate a schema across apps — always import from here.

```txt
src/
├── common.schema.ts        # Pagination, base schemas
├── athlete.schema.ts
├── club.schema.ts
├── tournament.schema.ts
├── event.schema.ts
├── inscription.schema.ts
├── match.schema.ts
├── ranking.schema.ts
└── index.ts
```

---

## Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) >= 9
- [Docker](https://www.docker.com) (for local PostgreSQL and Redis)
- A [Clerk](https://clerk.com) account for authentication

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/hiraokagabriel/BirdieAtlas.git
cd BirdieAtlas
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start local services

```bash
docker compose up -d
```

This starts PostgreSQL on port `5432` and Redis on port `6379`.

### 4. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Fill in the values as described in [Environment Variables](#environment-variables).

### 5. Run database migrations

```bash
pnpm --filter api db:migrate
```

### 6. Start the project

```bash
pnpm dev
```

| App | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| API | `http://localhost:3001` |
| Prisma Studio | `http://localhost:5555` (via `pnpm --filter api db:studio`) |

---

## Environment Variables

### `apps/api/.env.example`

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/birdie_atlas"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth (Clerk)
CLERK_SECRET_KEY=""
CLERK_PUBLISHABLE_KEY=""

# Uploads
CLOUDINARY_URL=""

# Email
RESEND_API_KEY=""

# App
NODE_ENV="development"
PORT=3001
```

### `apps/web/.env.example`

```env
# API
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Database

BirdieAtlas uses **PostgreSQL** as the primary database and **Prisma** as the ORM.

### Commands

```bash
# Create and apply migrations
pnpm --filter api db:migrate

# Generate Prisma client
pnpm --filter api db:generate

# Open Prisma Studio
pnpm --filter api db:studio

# Reset the database (development only)
pnpm --filter api db:reset
```

### Conventions

- Every model has `id` (`cuid()`), `createdAt` and `updatedAt`
- Business entities use soft delete via `deletedAt` — never physical `DELETE`
- Indexes on all fields used in filters and frequent ordering
- Migration names follow: `add_field_to_table` or `create_table_name`

### Core Data Model

```txt
Tenant
 └── has many Clubs, Athletes, Tournaments, Users, RankingConfigs

Athlete
 ├── belongs to Club (optional)
 ├── has many Pair (as athleteA or athleteB)
 ├── has many Inscriptions
 └── has many RankingEntries

Tournament
 ├── belongs to Tenant
 └── has many TournamentEvents (discipline + category)
       ├── has many Inscriptions
       └── has one Bracket
             └── has many Matches
                   ├── has many Games (sets)
                   └── has many MatchStats

RankingConfig (per tenant + discipline + season)
 ├── has many PointRules
 └── has many RankingEntries
```

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Phase 0** | Monorepo setup, CI/CD, auth, database, base config | 🔄 In progress |
| **Phase 1** | Athletes, pairs, clubs, bulk import, public profiles | ⏳ Planned |
| **Phase 2** | Tournaments, events, inscriptions, public tournament page | ⏳ Planned |
| **Phase 3** | Ranking engine, point rules, cache, ranking page | ⏳ Planned |
| **Phase 4** | Seeded bracket generation, all formats, public bracket | ⏳ Planned |
| **Phase 5** | Match flow, score entry, bracket progression, audit log | ⏳ Planned |
| **Phase 6** | Public portal, live results, athlete stats | ⏳ Planned |
| **Phase 7** | Admin dashboard, reports, governance, notifications | ⏳ Planned |
| **Phase 8** | Mobile, PWA, push notifications, E2E polish | ⏳ Planned |

Track progress in [Issues](https://github.com/hiraokagabriel/BirdieAtlas/issues) and [Milestones](https://github.com/hiraokagabriel/BirdieAtlas/milestones).

---

## Code Conventions

### TypeScript

- `strict: true` in all `tsconfig.json` files
- No `any` — use `unknown` or a proper type
- Enums as `as const`, never native TypeScript `enum`
- `interface` for public objects, `type` for compositions
- Types defined in `packages/types` and shared across apps

### Naming

| Target | Pattern |
|---|---|
| Files | `kebab-case` |
| React components | `PascalCase` |
| Functions and variables | `camelCase` |
| Global constants | `UPPER_SNAKE_CASE` |
| REST routes | `kebab-case` plural (e.g., `/api/athletes`) |
| Database tables | `snake_case` plural (via `@@map`) |
| Database columns | `camelCase` (Prisma default) |

### React components

- App Router pages are Server Components by default — no `'use client'` unless required
- Add `'use client'` only when using state, effects, event handlers or TanStack Query
- Props always typed with `interface`, never `any`
- Components over 150 lines must be split into subcomponents
- No prop drilling beyond 2 levels — use Context or TanStack Query

### API (Fastify)

- Every endpoint validates input with Zod before any logic
- Business logic lives in `services/` — never inline in the handler
- All write operations use `prisma.$transaction`
- Error response: `{ error, code, details? }`
- Success response: `{ data }` or `{ data, meta: { total, page, perPage } }`
- Role checked via middleware — never inline in the handler

### Git and PRs

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`
- Branch pattern: `feat/phase-X-feature-name` or `fix/bug-description`
- Scope examples: `athlete`, `club`, `bracket`, `ranking`, `match`, `admin`, `api`, `web`, `db`
- PRs require: description, link to the issue, test checklist
- Never commit directly to `main` — all code enters via PR with review
- One issue per PR whenever possible

---

## Contributing

1. Check [open issues](https://github.com/hiraokagabriel/BirdieAtlas/issues)
2. Comment on the issue you want to work on
3. Fork the repository
4. Create a branch: `feat/phase-X-feature-name`
5. Follow the code conventions described above
6. Open a Pull Request with a clear description and link to the issue

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">
  Made with 🏸 for the badminton community
</div>
