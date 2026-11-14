# Produção (versão online, custo zero)

Passo a passo da Fase 3 de [`PLANO_ONLINE.md`](PLANO_ONLINE.md). Nenhum provedor pede cartão. Faça na ordem: cada passo usa um valor do anterior.

> Segredos (URL do banco, PIN, chaves) ficam só nos painéis dos provedores e nos secrets do GitHub. O repositório é público: nunca cole nenhum deles em arquivo, issue ou PR.

## 1. Banco: Neon

1. Crie a conta em <https://neon.com> e um projeto com **Postgres 16** na região **AWS US East (N. Virginia)** (`aws-us-east-1`), a mesma da API.
2. Em **Connection details**, copie a URL **direta** (sem `-pooler` no host), com `?sslmode=require`. Ela é o `DATABASE_URL` de produção.

## 2. API: Render

1. Crie a conta em <https://render.com> e um **Web Service** ligado a este repositório, plano **Free**, região **Virginia (US East)**.
2. Configuração:
   - **Root directory:** vazio (raiz do repositório).
   - **Build command:** `corepack enable && pnpm install --frozen-lockfile && pnpm turbo run build --filter=@birdie-atlas/api`
   - **Start command:** `node apps/api/dist/index.js`
   - **Health check path:** `/health`
   - **Auto-Deploy:** **desligado** (o deploy vem do GitHub Actions, depois das migrations).
3. Variáveis de ambiente:

   | Variável | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `20` |
   | `DATABASE_URL` | a URL direta do Neon |
   | `DEFAULT_TENANT_SLUG` | `fpb-sp` |
   | `ADMIN_PIN` | 16+ caracteres aleatórios (é a senha do admin) |
   | `ADMIN_SESSION_SECRET` | 32+ caracteres aleatórios, gerados com `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `CORS_ORIGINS` | o endereço do web (passo 3), ex.: `https://birdieatlas.vercel.app,https://birdieatlas-*-<time>.vercel.app`. Nunca `https://*.vercel.app` |
   | `TRUST_PROXY` | `1` (confirme no passo 5) |

4. Em **Settings → Deploy Hook**, copie a URL do hook.

## 3. Web: Vercel

1. Antes, peça ao suporte da Vercel, por escrito, que confirme se o uso por uma federação sem fins lucrativos cabe no plano Hobby (ver §3.1 do plano). Guarde a resposta.
2. Crie a conta em <https://vercel.com> e importe este repositório, plano **Hobby**.
3. Configuração:
   - **Root directory:** `apps/web`
   - **Framework:** Next.js. **Build command:** `cd ../.. && pnpm turbo run build --filter=web`
   - **Nome do projeto:** decida agora. Ele vira o endereço (`<nome>.vercel.app`) que vai para cada QR code e súmula impressa, e trocar depois exige rebuild e reimpressão.
4. Variáveis de ambiente (são fixadas no build: trocar exige redeploy):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | o endereço do Render, ex.: `https://birdieatlas-api.onrender.com` |
   | `NEXT_PUBLIC_SITE_URL` | o endereço da Vercel, ex.: `https://birdieatlas.vercel.app` |

5. Em **Settings → Deployment Protection**, deixe a **Vercel Authentication** ligada para os previews.

## 4. GitHub: secrets do deploy

Em **Settings → Secrets and variables → Actions** do repositório, crie:

| Secret | Valor |
|---|---|
| `PRODUCTION_DATABASE_URL` | a URL direta do Neon |
| `RENDER_DEPLOY_HOOK_URL` | a URL do Deploy Hook do Render |

A partir daí, cada merge na `main` com CI verde roda o workflow **Deploy** (`.github/workflows/deploy.yml`): aplica as migrations no Neon e depois dispara o deploy da API. Sem esses secrets, o workflow termina sem fazer nada.

## 5. Primeiro deploy e conferência

1. Rode o workflow **Deploy** uma vez (ou faça um merge) para criar as tabelas no Neon.
2. Crie o tenant `fpb-sp` no banco novo (o seed é proibido fora do banco local).
3. Confira em produção:
   - `https://<api>/health` responde `{"ok":true}`;
   - as páginas públicas abrem; o login com o PIN funciona e sobrevive a um redeploy da API;
   - o placar ao vivo atualiza entre dois aparelhos (operador e telão);
   - CSV baixa com nome certo; o QR do telão aponta para o endereço da Vercel; o PWA instala.
4. `TRUST_PROXY`: o log da API mostra o IP de cada requisição. Abra o site e compare com o seu IP público (ex.: <https://ifconfig.me>). Se aparecer um IP interno do Render, aumente o valor até aparecer o seu.

## Restauração e dados

A migração dos dados locais e o backup automático cifrado são a Fase 4 do plano (§7). Não rode `pnpm db:restore` nem `db:seed` contra o Neon.
