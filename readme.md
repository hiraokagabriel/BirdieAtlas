# 🏸 BirdieAtlas

Full-stack web platform for badminton tournament management.

## 📋 Prerequisites

Before starting, make sure you have installed:

- **Node.js 22+** (LTS recommended) — [Download](https://nodejs.org/)
- **pnpm 9+** — [Installation](https://pnpm.io/installation)
- **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop/) (to run PostgreSQL locally)
- **Git** — [Download](https://git-scm.com/)

### Verifying installations

Open PowerShell and run:

```powershell
node --version      # Should show v22.x.x or higher
pnpm --version      # Should show 9.x.x or higher
docker --version    # Should show Docker version 24+
git --version       # Should show git version 2.x.x
```

---

## 🚀 Initial Setup (First Time)

### 1. Clone the repository

```powershell
# Navigate to the folder where you want to store the project
cd C:\projects

# Clone the repository (replace with your actual repo URL)
git clone git@github.com:YOUR_USERNAME/BirdieAtlas.git

# Enter the project folder
cd BirdieAtlas
```

### 2. Install dependencies

```powershell
# Install all monorepo dependencies
pnpm install
```

### 3. Configure environment variables

#### Backend (apps/api)

```powershell
# Create the .env file in the apps/api root
cd apps/api
Copy-Item .env.example .env  # If it exists, or create manually
```

Minimum content for `apps/api/.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/birdie_atlas?schema=public"

# Server
PORT=3001
NODE_ENV=development
```

#### Frontend (apps/web)

```powershell
# Go back to root and configure frontend
cd ../..
cd apps/web
Copy-Item .env.example .env  # If it exists, or create manually
```

Minimum content for `apps/web/.env.local`:

```env
# API URL
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Next.js
NEXT_PUBLIC_APP_NAME="BirdieAtlas"
```

### 4. Start the database with Docker

```powershell
# Go back to project root
cd ../..

# Create and start the PostgreSQL container
docker run -d \
  --name birdie_atlas_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=birdie_atlas \
  -p 5432:5432 \
  postgres:16-alpine
```

**Verify the database is running:**

```powershell
docker ps  # Should show birdie_atlas_db in the list
```

**If you need to stop/restart the database:**

```powershell
docker stop birdie_atlas_db
docker start birdie_atlas_db
```

### 5. Set up the database (Drizzle)

```powershell
# In the project root, run the schema push
pnpm --filter api db:push
```

This will:
- Read the schema from `apps/api/src/db/schema.ts`
- Create all tables in the `birdie_atlas` database
- Apply indexes and constraints

**Optional: Open Drizzle Studio to visualize the database**

```powershell
pnpm --filter api db:studio
```

Access `http://localhost:5555` in your browser.

---

## ▶️ Running the Project

### Development Mode (Recommended)

Open **two separate terminals** (or use PowerShell/Windows Terminal tabs):

#### Terminal 1 — Backend (Fastify)

```powershell
cd C:\projects\BirdieAtlas

# Start the API server at http://localhost:3001
pnpm --filter api dev
```

**What to expect:**
- Fastify server starts at `http://localhost:3001`
- Logs of registered routes
- Automatic hot reload on code changes

#### Terminal 2 — Frontend (Next.js)

```powershell
cd C:\projects\BirdieAtlas

# Start Next.js at http://localhost:3000
pnpm --filter web dev
```

**What to expect:**
- Next.js compiles and starts at `http://localhost:3000`
- Automatic hot reload on code changes
- Messages about generated routes (App Router)

### Accessing the application

After both servers are running:

- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:3001`
- **Drizzle Studio:** `http://localhost:5555` (if you ran `db:studio`)

---

## 📦 Available Scripts

### Global (project root)

```powershell
# Install dependencies for all apps
pnpm install

# Run all apps in development (if configured in turbo.json)
pnpm dev

# Production build for all apps
pnpm build

# Clean cache and node_modules
pnpm clean
```

### Backend (apps/api)

```powershell
# Development
pnpm --filter api dev

# Build
pnpm --filter api build

# Production
pnpm --filter api start

# Database
pnpm --filter api db:push      # Sync schema without migration (dev)
pnpm --filter api db:generate  # Generate migration files
pnpm --filter api db:migrate   # Apply pending migrations
pnpm --filter api db:studio    # Open Drizzle Studio
```

### Frontend (apps/web)

```powershell
# Development
pnpm --filter web dev

# Build
pnpm --filter web build

# Production
pnpm --filter web start

# Lint
pnpm --filter web lint
```

---

## 🗂️ Project Structure

```
BirdieAtlas/
├── apps/
│   ├── web/              # Next.js 15 (Frontend)
│   │   ├── src/
│   │   │   ├── app/      # Routes (App Router)
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── .env.local
│   │   └── package.json
│   │
│   └── api/              # Fastify (Backend)
│       ├── src/
│       │   ├── db/
│       │   │   ├── index.ts      # Drizzle instance
│       │   │   └── schema.ts     # Database schema (source of truth)
│       │   ├── routes/           # API routes
│       │   └── index.ts
│       ├── .env
│       └── package.json
│
├── packages/             # Shared packages
│   ├── types/
│   ├── validators/
│   └── config/
│
├── docker-compose.yml    # (Optional) Docker for DB
├── turbo.json          # Turborepo config
├── pnpm-workspace.yaml
└── package.json
```

---

## 🐛 Troubleshooting

### Database connection fails

**Error:** `ECONNREFUSED` or `could not connect to server`

**Solution:**

```powershell
# Check if the container is running
docker ps

# If not, start it
docker start birdie_atlas_db

# If you need to recreate
docker rm -f birdie_atlas_db
docker run -d --name birdie_atlas_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=birdie_atlas -p 5432:5432 postgres:16-alpine
```

### Port 3000 or 3001 already in use

**Error:** `EADDRINUSE`

**Solution:**

```powershell
# Find the process using the port
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Kill the process (replace PID with the returned number)
taskkill /PID <PID> /F
```

### Drizzle push fails

**Error:** `relation already exists` or `migration error`

**Solution (development only):**

```powershell
# Clean the database and push again
pnpm --filter api db:push --force
```

**Warning:** `--force` may delete data!

### Dependencies out of sync

**Symptom:** Type errors or module not found

**Solution:**

```powershell
# Clean cache and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm pnpm-lock.yaml

pnpm install
```

### Next.js fails to compile

**Error:** `Module not found` or `Cannot find module`

**Solution:**

```powershell
# Clean Next.js cache
rm -rf .next
rm -rf apps/web/.next

# Reinstall web dependencies
pnpm --filter web install

# Run dev again
pnpm --filter web dev
```

---

## 🧪 Testing (Future)

When implemented:

```powershell
# Unit tests
pnpm test

# E2E tests with Playwright
pnpm test:e2e
```

---

## 📝 Development Checklist

Before committing:

- [ ] TypeScript code without errors (`pnpm --filter web lint` / `pnpm --filter api lint`)
- [ ] Tests passing (when implemented)
- [ ] Migrations generated if schema changed (`pnpm --filter api db:generate`)
- [ ] Commit follows Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- [ ] Branch follows pattern (`feat/phase-X-name`, `fix/description`)

---

## 🔗 Useful Links

- **Turborepo Documentation:** https://turborepo.org/docs
- **Drizzle ORM:** https://orm.drizzle.team
- **Next.js 15:** https://nextjs.org/docs
- **Fastify:** https://fastify.dev/docs
- **Shadcn/ui:** https://ui.shadcn.com

---

## 📌 Project Phases

| Phase | Scope | Status |
|------|--------|--------|
| Phase 0 | Monorepo, CI/CD, auth, database, base config | 🔄 In progress |
| Phase 1 | Athletes, doubles, clubs, import, public profiles | 🔄 In progress |
| Phase 2 | Tournaments, categories, registrations, public pages | 🔄 In progress |
| Phase 3 | Ranking engine, points rules, cache | ⏳ Planned |
| Phase 4 | Draw generation with seeding, all formats | ⏳ Planned |
| Phase 5 | Match flow, score entry, progression | ⏳ Planned |
| Phase 6 | Public portal, live results | ⏳ Planned |
| Phase 7 | Admin dashboard, reports | ⏳ Planned |
| Phase 8 | Mobile, PWA, push notifications | ⏳ Planned |

---

## 🤝 Contributing

1. Create a branch for your feature (`git checkout -b feat/phase-1-athletes`)
2. Commit your changes (`git commit -m 'feat: add athletes CRUD'`)
3. Push to the branch (`git push origin feat/phase-1-athletes`)
4. Open a Pull Request

---

## 📄 License

MIT — see `LICENSE` file in the project root.

---

**Last updated:** August 2026  
**Project version:** Phase 1 (In progress)
