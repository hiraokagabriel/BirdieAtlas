# Plano: BirdieAtlas online com custo zero

> Base: commit `91110cd` (main). Fontes dos provedores consultadas em **14/11/2026**. **Aprovado em 14/11/2026**, com as decisões abaixo.

## 0. Decisões do usuário (14/11/2026)

- **Plano aprovado** como está, com dois ajustes:
- **Sem domínio próprio:** a versão online usa os subdomínios dos provedores (`*.vercel.app` para o web e `*.onrender.com` para a API). Clerk fica descartado de vez (exige domínio). Decidir o nome do projeto na Vercel antes da Fase 3: ele vira o endereço dos QR codes e das súmulas impressas.
- **Minimização de dados:** o atleta guarda só **nome e sobrenome** e **ano de nascimento**, além dos dados esportivos que as chaves exigem (gênero da categoria, clube, nacionalidade). **E-mail sai** e a **data de nascimento completa vira ano** (nova Fase 1a). Não há CPF, telefone nem upload de foto. Isso reduz o peso da LGPD (§6): continuam sendo dados pessoais, inclusive de menores, mas nenhum é sensível nem de contato.
> Legenda: **[F]** = fato verificado (no código, com caminho:linha, ou na fonte citada). **[S]** = suposição ou dado não reconferido; confirme antes de depender dele.

---

## 1. Resumo executivo

1. **Web (Next.js 16)** no **Vercel Hobby**, com deploy pela integração Git e preview por PR. Antes, peça ao suporte da Vercel, por escrito, que confirme o enquadramento (ver §3.1).
2. **API (Fastify)** no **Render Free**, um único serviço Node na região Virginia (ou Ohio). Uma instância só, então o live bus em memória continua válido.
3. **Postgres** no **Neon Free**, em PG 16 e `aws-us-east-1`, ao lado da API. Migrations rodam no GitHub Actions antes do deploy da API.
4. **Login:** primeiro o PIN atual, endurecido e com sessão que sobrevive a reinícios (token HMAC sem estado). Depois, **Better Auth** (MIT, dados no nosso Postgres, sem limite de usuários) no lugar do Clerk, para registrar "quem" fez cada ação e gerir papéis.
5. **Backup:** `pg_dump` diário, cifrado com `age`, rodando num **repositório privado** separado. Artefatos de repositório público podem ser baixados por qualquer usuário logado no GitHub.

**Alternativa:** uma VM **Oracle Cloud Always Free em São Paulo**, com `docker compose` (Postgres, API, web e Caddy). Não exige nenhuma mudança de arquitetura, mas pede cartão e manutenção do servidor, e a VM pode ser recolhida se ficar ociosa (§3.3).

---

## 2. Inventário do que precisa continuar funcionando (verificado no código)

| Recurso | Onde | Impacto online |
|---|---|---|
| Modo admin por PIN, sessões em memória | `apps/api/src/domain/admin-session.ts:32-33` (`Map` de sessões e de falhas) | Reiniciar a API derruba as sessões. No free tier isso acontece sempre (spin-down, deploy, reinício pelo provedor). |
| Guard global | `apps/api/src/middleware/admin-guard.ts:44-47`, `:58-71` | `DEV_ADMIN_MODE=true` libera tudo **mesmo com `NODE_ENV=production`** (linha 46). Só a rota `PATCH /dev/admin-mode` some em produção (linha 115). |
| Bloqueio de PIN por IP | `admin-guard.ts:86` (`request.ip`), `index.ts:24-25` (sem `trustProxy`) | Atrás do proxy, todos os clientes compartilham o IP do proxy: 5 erros de qualquer pessoa bloqueiam o admin. |
| CORS | `apps/api/src/index.ts:32-36` (`origin: true`) | Hoje reflete qualquer origem. |
| SSE ao vivo | `apps/api/src/routes/live.ts:130-197`; a origem é copiada à mão em `live.ts:137-141` | Funciona num servidor Node de longa duração. O cabeçalho copiado à mão ignora qualquer lista de origens permitidas. |
| Live bus em memória | `apps/api/src/services/live-bus.ts:16-46`, instância em `services/live-match.ts:71`; publicado em `routes/draws.ts:173,372,387-388` e `routes/live.ts:251-340` | Exige uma instância só. |
| Reconexão do EventSource | `apps/web/src/components/live/use-live-matches.ts:39-41` e `connect`/`onerror` | Já tem backoff, fallback para polling e snapshot ao reconectar. **Não precisa mudar.** |
| QR do telão, og:image, metadataBase | `apps/web/src/lib/share.ts:19-21,108`, `components/live/tv-qr-code.tsx:15`, `app/layout.tsx:22` | Dependem de `NEXT_PUBLIC_SITE_URL`, que é **congelada no build** (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:158-166`). Trocar o domínio exige rebuild. |
| Imagens de compartilhamento | `apps/web/src/app/(public)/{t,a,r}/.../share-image/route.tsx`, cache em `lib/share-image/respond.tsx:18`, fonte baixada do Google em `lib/share-image/fonts.ts` | Funcionam em função da Vercel. A CDN guarda o resultado (`s-maxage=300`). |
| PWA / service worker | `apps/web/public/sw.js`, `next.config.ts` | O HTTPS do provedor resolve a instalação. A API (outra origem) não passa pelo SW. |
| Token admin no navegador | `apps/web/src/lib/admin-token.ts` (localStorage + `Authorization: Bearer`) | Funciona entre domínios diferentes (vercel.app e onrender.com) sem cookie de terceiros. |
| CSV | `exposedHeaders: ['Content-Disposition']` em `index.ts:35` | Precisa continuar na config de CORS nova. |
| Backup e restauração | `scripts/db-backup.mjs`, `scripts/db-restore.mjs` (rodam `docker compose exec`) | **Não servem contra o Neon.** O backup na nuvem roda `pg_dump` direto (§7). |
| Seed | `apps/api/src/scripts/seed.ts:156-172` | **Não tem proteção contra produção:** `--reset` apaga tabelas em qualquer `DATABASE_URL`. `reset-db.ts:12-16` e `create-db.ts:12-16` têm proteção. |
| Uploads de arquivo | nenhum (não há multipart; a planilha é lida no navegador) | Não precisa de storage (Cloudinary e Uploadthing saem do plano). |
| Dados pessoais no schema | `apps/api/src/db/schema.ts` (`birthYear`; `email` e `birthDate` saíram na Fase 1a) | Não há CPF nem telefone hoje. Esses campos só saem por rotas em `ADMIN_ONLY_READS` (`admin-guard.ts:22-30`). |

---

## 3. Hospedagem gratuita: provedores e limites

| Provedor | Plano grátis (limites reais) | Problema para nós | Fonte (consulta em 14/11/2026) |
|---|---|---|---|
| **Vercel Hobby** | 100 GB de Fast Data Transfer, 1M de invocações, 4 h de CPU ativa, 360 GB-h de memória, 1M de requisições na CDN, função de até 300 s, logs de 1 h, 100 deploys/dia. Estourou: espera 30 dias. Inclui Vercel Authentication para previews. **[F]** | Termos: *"You shall only use the Services under a Hobby plan for your personal or non-commercial use"*; "commercial" não é definido nos Termos. **[F]** | [Hobby](https://vercel.com/docs/plans/hobby), [Fair use](https://vercel.com/docs/limits/fair-use-guidelines), [Termos §4](https://vercel.com/legal/terms) |
| **Render Free** (web service) | 750 h/mês por workspace. **Hiberna após 15 min sem tráfego de entrada** (HTTP ou mensagem WebSocket). Acordar leva ~1 min. Pode ser reiniciado a qualquer momento. Esgotou as horas: suspenso até o mês seguinte. **[F]** | Cold start de 1 min. Heartbeat SSE é saída e provavelmente não segura o serviço acordado **[S]**. | [render.com/docs/free](https://render.com/docs/free) |
| Render Postgres Free | 1 GB, **expira em 30 dias**, sem backup **[F]** | Inviável | idem |
| **Neon Free** | 1 GB por projeto, 100 CU-h/projeto/mês, suspende após 5 min ocioso, 5 GB/mês de egress, PITR de 6 h, 10 branches, sem expiração, sem cartão. Estourou: compute suspenso ou escrita bloqueada. **[F]** Região São Paulo `aws-sa-east-1` existe **[F]**. | 100 CU-h ÷ 0,25 CU = ~400 h de banco ativo por mês. O keep-alive não pode tocar o banco. | [neon.com/pricing](https://neon.com/pricing), [regiões](https://neon.com/docs/introduction/regions) |
| Supabase Free (só Postgres) | 500 MB, 5 GB de egress, **pausa após 7 dias inativo**, 2 projetos, sem backup **[F]** | A federação passa semanas sem torneio: o projeto pausaria. | [supabase.com/pricing](https://supabase.com/pricing) |
| Koyeb Free | 1 serviço com 512 MB, 0,1 vCPU, Frankfurt ou Washington. Scale-to-zero após 1 h **[F, docs via busca]**. Postgres grátis com 5 h ativas e 1 GB **[F]**. | Bom substituto do Render (hiberna menos). Postgres grátis inútil. Empresa adquirida pela Mistral **[F, blog]**. | [FAQ de preços](https://www.koyeb.com/docs/faqs/pricing), [blog](https://www.koyeb.com/blog/sustaining-free-compute-in-a-hostile-environment) |
| Fly.io | **Sem plano grátis para organizações novas.** Crédito de US$1 por 7 dias. Conta abaixo de US$5 é perdoada. **[F]** | Exige cartão. Não é grátis garantido. | [docs.fly.io/about/pricing](https://docs.fly.io/about/pricing) |
| Railway | Trial de US$5 por 30 dias. Depois, US$1/mês de crédito, 0,5 GB de RAM, **0 domínios próprios** **[F]** | US$1/mês não sustenta API e banco 24/7 **[S]** | [railway.com/pricing](https://railway.com/pricing) |
| Google Cloud Run | Por requisição: 2M de requisições, 180.000 vCPU-s e 360.000 GiB-s por mês **[F, via busca]**. Exige conta de faturamento (cartão) **[S]**. Timeout de até 60 min **[S]**. | Viável (região São Paulo, `max-instances=1`). Precisa de cartão e risco de cobrança sem teto. | [cloud.google.com/run/pricing](https://cloud.google.com/run/pricing) |
| Cloudflare Workers Free | 100k requisições/dia, **10 ms de CPU por requisição**, 128 MB, stream sem limite de duração **[F]** | SSR do Next 16 e `ImageResponse` dificilmente cabem em 10 ms de CPU **[S]**. Para a API Fastify, exigiria reescrita. | [limites](https://developers.cloudflare.com/workers/platform/limits/) |
| Netlify Free | 300 créditos. Deploy de produção = 15 créditos (~20 deploys/mês). 20 créditos/GB. Não cita restrição comercial. **[F]** | Deploy a cada merge na main esgota os créditos. | [netlify.com/pricing](https://www.netlify.com/pricing/) |
| **Oracle Always Free** | A1 Arm: 1.500 OCPU-h e 9.000 GB-h/mês (= 2 OCPU e 12 GB em tenancy Always Free), 2 VMs AMD micro, 200 GB de bloco, **10 TB/mês de saída**. **VM ociosa pode ser recolhida** se, em 7 dias, CPU p95, rede e memória ficarem abaixo de 20%. **[F]** | Nosso uso é ocioso quase sempre: risco real de recolhimento. Cartão no cadastro e capacidade A1 escassa **[S]**. | [docs.oracle.com](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm) |

### 3.1 Vercel Hobby e uso por federação

- **[F]** Os Termos limitam o Hobby a "personal or non-commercial use" sem definir comercial. Textos citados por terceiros falam em "financial gain" e em processar pagamento de visitantes. A doc oficial manda consultar o suporte em caso de dúvida ([comunidade](https://community.vercel.com/t/hobby-plan-eligibility-for-a-volunteer-built-internal-portal-for-a-non-profit-ieee-student-branch/51181)).
- **[S]** Uma federação sem fins lucrativos, sem cobrança no site e com desenvolvedor não remunerado tem bom argumento de "non-commercial", mas não há garantia.
- **Decisão:** abrir chamado no suporte da Vercel, descrever o caso e guardar a resposta antes de anunciar o site. Se a resposta for negativa, mova o web para o plano B (§3.3) ou para o Render, ao lado da API (§12).

### 3.2 Arquitetura recomendada (principal)

```
Navegador ──HTTPS──> Vercel Hobby (Next.js, região iad1)
    │                      │ SSR: fetch NEXT_PUBLIC_API_URL
    │                      v
    └──HTTPS/SSE/Bearer──> Render Free (Fastify, Virginia, 1 instância)
                               │ TLS (sslmode=require)
                               v
                          Neon Free (PG 16, aws-us-east-1)
GitHub Actions: CI + E2E (já existem), migração + deploy hook, keep-alive opcional
Repositório PRIVADO separado: pg_dump diário cifrado com age
```

Por que assim:

- **Mudança mínima.** A API continua um processo Node de longa duração. SSE com `reply.hijack()` (`live.ts:142`) e o live bus funcionam sem mudança, porque o Render Free roda uma instância só. Serverless puro (funções Vercel/Cloudflare para a API) quebraria SSE e o estado em memória.
- **Sem cartão em nenhum provedor** **[F]** para Render, Neon e Vercel Hobby.
- **Mesma região.** API e banco em us-east evitam ~120 ms de ida e volta por consulta. As escritas ao vivo fazem várias consultas por transação (`live.ts:205+`).
- **O Neon não pausa por inatividade de dias** (diferente do Supabase) e tem PITR de 6 h.
- **Custo da escolha:** primeira visita depois de >15 min ociosa espera ~1 min (mitigação em §4.4). Os dados ficam nos EUA (transferência internacional, ver §6).

### 3.3 Alternativa: Oracle Always Free (São Paulo), tudo numa VM

- `docker compose` com `postgres:16-alpine` (o mesmo serviço do `docker-compose.yml`), API, `next start` e Caddy (HTTPS automático via Let's Encrypt).
- **Vantagens:** o código não muda; dados no Brasil; `scripts/db-backup.mjs` funciona como está (roda `docker compose exec`); 10 TB de saída; sem cold start.
- **Desvantagens:** cartão no cadastro **[S]**; recolhimento de VM ociosa **[F]** (mitigar com conta Pay-As-You-Go, que **[S]** tira a política de ociosidade e mantém o grátis dentro dos limites, mas abre a chance de cobrança); você vira o sysadmin (patches, firewall, chaves SSH); ponto único de falha; capacidade A1 escassa **[S]**.
- **Quando escolher:** se a Vercel negar o Hobby, se a LGPD exigir dados no Brasil, ou se o cold start do Render for inaceitável em dia de torneio.
- **Terceira via:** Cloud Run (`southamerica-east1`, `max-instances=1`) com Neon `aws-sa-east-1`. Exige conta de faturamento.

---

## 4. Compatibilidade do código com o ambiente online

### 4.1 O que quebra e a correção mínima

| # | Problema | Código | Correção mínima |
|---|---|---|---|
| C1 | Sessões admin somem a cada reinício ou hibernação: o operador da mesa precisa redigitar o PIN no meio do torneio | `admin-session.ts:32,57-60,63-72` | **Token HMAC sem estado**, sem schema: `token = base64url(expiresAt) + "." + HMAC(chave, expiresAt)`, com `chave = HMAC(ADMIN_SESSION_SECRET, pin)`. Trocar o PIN ou o segredo revoga todas as sessões. `isValid` confere a assinatura com `timingSafeEqual` e o prazo. `DELETE /admin/session` passa a só limpar o navegador. Perde-se a revogação individual, aceitável com TTL de 12 h. *Alternativa com revogação:* tabela `admin_sessions(token_hash, expires_at)`, que custa uma migration e vira descarte quando o Better Auth chegar. |
| C2 | `DEV_ADMIN_MODE=true` em produção abre tudo | `admin-guard.ts:46` | Na subida (`index.ts:28`): com `NODE_ENV=production`, recusar subir se `DEV_ADMIN_MODE==='true'` **ou** se não houver `ADMIN_PIN` (depois, auth). Teste em `admin-guard.test.ts`. O E2E não é afetado: roda sem `NODE_ENV=production` (`apps/e2e/playwright.config.ts:72-77`). |
| C3 | IP do proxy no lugar do IP do cliente | `index.ts:24-25`, `admin-guard.ts:86` | `Fastify({ trustProxy: Number(process.env.TRUST_PROXY ?? 0) })`, com o **número de saltos** e nunca `true`: com `true`, o Fastify confia em todo o `X-Forwarded-For` e o cliente forja o IP. A quantidade de saltos do Render **[S]** precisa ser medida no deploy (logar `request.ip` e comparar com o seu IP). |
| C4 | CORS aberto | `index.ts:32-36`; `live.ts:137-141` | `origin`: em produção, lista de `CORS_ORIGINS` (domínio de produção mais o padrão de preview da Vercel). Fora de produção continua `true` (dev e E2E). No SSE, remover a cópia manual da origem (`live.ts:137-141`) ou condicioná-la à mesma lista. |
| C5 | Hibernação do Render com só SSE aberto | spin-down por falta de tráfego de entrada | O telão já recarrega a fila a cada 15 s (`ESPECIFICACAO_COMPLETA.md:82`), o que gera tráfego de entrada. Quando o serviço reinicia, o cliente reconecta e recebe snapshot (`use-live-matches.ts`). Não precisa de código. Keep-alive opcional (§4.4). |
| C6 | Seed apaga produção | `seed.ts:156-172` | A mesma proteção de `reset-db.ts:12-16` (recusa `NODE_ENV=production` e host não local). |
| C7 | `NEXT_PUBLIC_*` congelado no build | `share.ts`, `tv-qr-code.tsx:15`, `api.ts:5` | Configurar no projeto Vercel antes do primeiro build. Trocar o domínio exige redeploy. QR impresso com o domínio antigo quebra (decidir o domínio cedo, §9). |
| C8 | Backup e restauração dependem do `docker compose` | `scripts/db-backup.mjs` (`composeExec`) | Não mexer nos scripts locais. Backup na nuvem por workflow com `pg_dump` direto (§7). |

### 4.2 O que não quebra (verificado)

- **Live bus em memória:** o Render Free tem uma instância, e o Vercel não participa do SSE (o EventSource vai direto à API, `use-live-matches.ts`, `new EventSource(${API_URL}/...)`). LISTEN/NOTIFY, Redis e polling **não são necessários agora**. A troca está documentada (`live-bus.ts:6-8`, `ESPECIFICACAO_COMPLETA.md:393`) para quando houver mais de uma instância. Nesse dia, com o Neon, LISTEN precisa da conexão **direta**, não da pooled **[S]**.
- **Heartbeat de 15 s e `socket.setTimeout(0)`** (`live.ts:145,196`) seguram os proxies intermediários.
- **Pool `pg`** (`db/index.ts:90-92`): o padrão fecha conexões ociosas após 10 s, então o Neon consegue suspender. Use a URL **direta** do Neon (uma instância só, sem PgBouncer) com `?sslmode=require`. O código não usa `.prepare()` nem advisory locks (grep vazio), então a URL pooled também serviria.
- **Tenant em cache** (`tenant.ts`), **og:image**, **PWA**, **CSV** e **check-in, súmulas e histórico de resultados** são HTTP comum e não mudam.

### 4.3 Rate limit

- Adicionar `@fastify/rate-limit` (plugin oficial do Fastify; uma dependência nova se justifica porque a API passa a ficar exposta à internet), em memória, que basta com uma instância.
- Limite global moderado por IP. Mais estrito em `POST /admin/session`, além do bloqueio que já existe (`admin-session.ts:10-11`).
- Excluir `GET /tournaments/:id/live` do limite por requisição: a conexão é longa e conta uma vez.
- Depende de C3: sem `trustProxy` certo, o limite atinge todo mundo junto.
- **PIN na internet:** exigir pelo menos 16 caracteres aleatórios em produção. Com IPs distribuídos, 10^8 deixa de ser seguro: o argumento em `admin-session.ts:7` vale para rede local.

### 4.4 Cold start (Render)

- Rota `GET /health` que **não toca o banco** (para não gastar CU-h do Neon). É GET e não está em `ADMIN_ONLY_READS`, então o guard já a deixa pública.
- **Opcional:** pinger a cada 10-14 min das 6 h às 23 h. Opções: workflow agendado (minutos grátis em repositório público **[S]**; o GitHub desliga workflows agendados após 60 dias sem atividade no repositório público **[F]**, [doc](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)) ou cron-job.org **[S]**.
- 750 h cobrem um serviço 24/7 (744 h em mês de 31 dias) **[F]**.
- **[S]** Não achei texto do Render proibindo ping de manutenção. Um comentário de fórum alerta para possível violação. Registrado como risco R3.

---

## 5. Autenticação

| Opção | Custo zero? | Encaixe | Veredito |
|---|---|---|---|
| **Clerk Hobby** | 50.000 MRU/app, 100 organizações, até 20 membros por organização, papéis só Admin e Member (papéis próprios exigem add-on pago de US$100/mês) **[F]** ([pricing](https://clerk.com/pricing)). **A instância de produção exige domínio próprio com DNS editável; `*.vercel.app` não serve** **[F]** ([docs](https://clerk.com/docs/guides/development/deployment/vercel.md)). | Os 6 papéis da spec (`ESPECIFICACAO_COMPLETA.md:578`) exigiriam `publicMetadata` próprio. Logo na entrada da tela fica a marca do Clerk. | **Não.** Exige domínio pago, e o modelo de papéis da spec não cabe no grátis. |
| Supabase Auth | 50k MAU **[F]** | Roda num projeto Supabase Free, que **pausa após 7 dias sem uso** **[F]**. O próprio `CLAUDE.md` diz que Supabase Auth não se aplica. | Não. |
| Auth.js | Grátis (open source) | Centrado no Next. Nossa autorização mora na API Fastify (guard global), não no Next. | Não. |
| **Better Auth** | Grátis, self-hosted, licença MIT **[S]**, sem limite de usuários | Adaptador Drizzle com `provider: "pg"` e schema gerado para `drizzle-kit generate`/`migrate` **[F]** ([doc](https://www.better-auth.com/docs/adapters/drizzle)). Guia oficial para Fastify (`/api/auth/*`, `trustedOrigins`) **[F]** ([doc](https://www.better-auth.com/docs/integrations/fastify)). Plugins `admin` (papéis), `bearer` e `organization` **[S]**. | **Sim, na Fase 6.** |
| PIN com sessão persistida | Grátis | Já existe, com mudança mínima (C1). Não identifica pessoas. | **Sim, para entrar no ar (Fases 1-2).** |

**Decisões:**

1. Entrar no ar com o PIN (C1-C3). Isso entrega tudo que existe hoje.
2. Na Fase 6, trocar o Clerk pelo Better Auth:
   - Plugin **bearer**, que mantém o modelo atual de token em localStorage e `Authorization` (`admin-token.ts`, `api.ts:53`) e evita cookie entre sites (vercel.app × onrender.com).
   - Cadastro aberto **desligado**: usuários criados por um `federation_admin`.
   - Reset de senha pelo admin (plugin admin), sem precisar de e-mail.
   - Papéis da spec numa coluna `role`. Tenant continua `DEFAULT_TENANT_SLUG`; o seletor de tenant fica para quando houver uma segunda federação.
3. O guard continua o lugar único de autorização (`admin-guard.ts`): `isAdminRequest` passa a perguntar à sessão do Better Auth e ao papel.

**Itens que dependem de identidade (Fase 6):**

- **"Quem" no histórico de resultados:** coluna anulável `actor_user_id` em `match_result_events` (expand; resultados antigos ficam nulos).
- **Auditoria de inscrições:** `reviewed_by` e `reviewed_at` nas inscrições. Contrato em `docs/api/tournament-registrations.md`.
- **Gestão de usuários e papéis:** tela no admin com `Field`, `ChoiceGroup` e `Dialog`, coberta pelo spec WCAG.

---

## 6. Segurança e privacidade na internet pública

1. **Segredos:** só nos painéis da Render, Vercel e Neon e em secrets do GitHub. O repositório é público: nada de `.env` (o `.gitignore` já cobre). `DATABASE_URL` de produção nunca entra em workflow de PR de fork (secrets não são expostos a forks por padrão **[S]**).
2. **`DEV_ADMIN_MODE` impossível em produção:** C2. Também vale conferir o botão de modo admin (`apps/web/src/components/dashboard/admin-mode-toggle.tsx:24`), que já se esconde em produção sem PIN.
3. **CORS, `trustProxy` e rate limit:** C3, C4 e §4.3.
4. **HTTPS:** automático em `*.vercel.app` e `*.onrender.com` **[S]**. Cabeçalhos de segurança no `next.config.ts` (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`). Um CSP completo pode vir depois: o token em localStorage torna XSS o risco principal.
5. **Privacidade dos endpoints:** a regra de `publicAthleteColumns` não muda. Acrescentar um teste HTTP na API (`app.inject`) que percorre as rotas GET públicas e falha se aparecer `birthYear` (ou `email` e `birthDate`, se um dia voltarem). É barato e trava regressões antes de o site ficar exposto.
6. **LGPD:** a federação é a controladora; Vercel, Render e Neon são operadores.
   - Publicar `/privacidade` (finalidade, base legal, retenção, contato do encarregado).
   - Procedimento para pedido do titular. O soft delete guarda os dados, então pedido de eliminação pede anonimização dos campos pessoais. Isso pode virar endpoint admin depois.
   - **Menores de idade** (categorias de base) exigem atenção ao art. 14 da LGPD: validar com o jurídico da federação **[S]**.
   - **Transferência internacional:** com o plano principal, os dados ficam nos EUA. Citar na política e conferir os DPAs dos provedores **[S]**. Se o jurídico exigir Brasil, use o plano B ou a terceira via.
   - **Logs:** o logger do Fastify grava IP (dado pessoal); a retenção curta do provedor ajuda.
   - **Backups cifrados** (§7).
7. **Religar `ENABLE_CODE_SECURITY_REVIEW`:** apagar a chave em `.claude/settings.json`. Atualizar `CLAUDE.md`, `docs/SETUP.md` e a linha de dívida em `PROGRESS.md`. O `CLAUDE.md` pede "combinar" antes; este plano é a proposta, e o usuário precisa aprovar.
8. **Dependências:** ativar Dependabot alerts e Secret scanning (grátis em repositório público **[S]**).

---

## 7. Banco: migrations, backup, restauração e migração de dados

**Migrations no deploy** (nunca `db:push`):

- Job `deploy-api` em `.github/workflows/`, só em push na `main` e depois de `verify` e `e2e` verdes.
- Passos: `pnpm --filter @birdie-atlas/api db:migrate`, com `DATABASE_URL` direta do Neon como secret; depois `curl` no **Deploy Hook** do Render (URL em secret). Com auto-deploy desligado no Render.
- Migration antes do código é seguro porque a regra do projeto é expandir e contrair (`CLAUDE.md`).
- **[S]** O pre-deploy command do Render provavelmente não existe no free, por isso a migração fica no Actions.

**Backup automático (grátis):**

- **[F]** Artefatos de Actions podem ser baixados por quem está logado e tem leitura no repositório. Num repositório público, isso é qualquer usuário logado ([doc](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), [nightly.link](https://nightly.link/)). **Nunca fazer backup pelo repositório público.**
- Criar o repositório **privado** `birdieatlas-backups` com um workflow diário:
  - `pg_dump -Fc` pela imagem `postgres:16-alpine`, na mesma versão do Neon.
  - Cifrar com `age -r <chave pública>`. A chave privada fica offline, com a federação, então um vazamento de secret do workflow não abre os dumps.
  - `upload-artifact` com `retention-days: 90`.
- Workflow agendado em repositório privado não sofre a regra de 60 dias, que é de repositório público **[F]**. Minutos grátis de repositório privado (2.000/mês no GitHub Free **[S]**) sobram para ~2 min/dia.
- Complemento: PITR de 6 h do Neon **[F]**, para erro humano no próprio dia.

**Restauração:**

- Runbook em `SETUP.md`: baixar, rodar `age -d`, depois `pg_restore --clean --if-exists --no-owner --no-privileges -d <URL direta>`, depois `db:migrate`.
- **Ensaio mensal** num **branch do Neon** (grátis, até 10), nunca no principal.
- Os scripts locais não mudam.

**Migração dos dados locais para a nuvem:**

1. `pnpm db:backup` local.
2. **[S]** Confirmar se o banco local tem dados do seed misturados com dados reais. Se tiver, limpar antes ou migrar só os torneios reais pela importação de planilha.
3. Criar o projeto no Neon com PG 16.
4. `pg_restore --no-owner --no-privileges` com a URL direta. O dump já traz o schema `drizzle` com o histórico de migrations.
5. `db:migrate` (deve ser no-op).
6. Conferir o tenant `fpb-sp` e contagens por tabela contra o local.
7. **Nunca rodar `db:seed` em produção** (C6).

---

## 8. CI/CD (GitHub Actions, grátis)

- **Mantém:** `verify` e `e2e` em `.github/workflows/ci.yml`. O E2E roda com Postgres próprio e não toca produção. O upload de relatório só tem dados de fábrica de teste.
- **Novo** `deploy-api` (§7), que depende de `verify` e `e2e`.
- **Web:** integração Git da Vercel, com root `apps/web`, build pelo turbo (`turbo run build --filter=web`, que compila `validators` antes) e Node 20.
  - Preview por PR com **Vercel Authentication** (disponível no Hobby **[F]**).
  - Preview usa a API de produção só para leitura. Escrita exige PIN: regra operacional de não usar o PIN em preview.
  - O padrão de domínio de preview entra em `CORS_ORIGINS`.
- **API no Render:** build `pnpm install --frozen-lockfile && pnpm turbo run build --filter=@birdie-atlas/api`, start `node apps/api/dist/index.js`, `NODE_VERSION=20`, `NODE_ENV=production`.
- **Variáveis de ambiente:**
  - API: `DATABASE_URL`, `DEFAULT_TENANT_SLUG=fpb-sp`, `ADMIN_PIN`, `ADMIN_SESSION_SECRET`, `CORS_ORIGINS`, `TRUST_PROXY`, `NODE_ENV`.
  - Web: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`.

---

## 9. Domínio

| Opção | Custo | Efeito |
|---|---|---|
| Subdomínios dos provedores (`birdieatlas.vercel.app`, `birdieatlas-api.onrender.com`) | R$0 | Funciona com PIN e com Better Auth (bearer). Clerk não funciona. Trocar depois exige rebuild (C7) e invalida QR codes e súmulas já impressos. |
| **Subdomínio do domínio que a federação já tem** (ex.: `atlas.<federação>.org.br` e `api.atlas.<federação>.org.br`) | R$0 se o domínio já existe | **Recomendado.** Endereço estável para QR e og:image, e mesmo site para web e API (cookies viáveis no futuro). Vercel Hobby aceita domínio próprio **[F]** (50 por projeto); Render Free **[S]**. |
| `.com.br` novo | ~R$40/ano **[S]** | Único custo recorrente que pode valer a pena se a federação não tiver domínio. |

Decidir **antes da Fase 3**: `NEXT_PUBLIC_SITE_URL` vai para o bundle e para cada QR impresso.

---

## 10. Itens que só fazem sentido online

| Item | Cabe no zero? | Nota |
|---|---|---|
| **Web Push (VAPID)** | Sim | O protocolo é grátis; o próprio servidor envia. Precisa de tabela de assinaturas (migration), da lib `web-push` (dependência nova) e de disparo no início de partida (pelo mesmo ponto que publica no `liveBus`). iOS só recebe com o PWA instalado **[S]**. Seguir torneio ou atleta não exige login. |
| E-mail | Sim, com limites | Resend Free: 3.000/mês e **100/dia** **[F]** ([pricing](https://resend.com/pricing)). Exige domínio verificado para enviar a terceiros **[S]**. Brevo Free: ~300/dia com a marca da Brevo **[S, fontes secundárias]**. Só depois da Fase 6 (destinatários identificados). |
| WhatsApp (API oficial) | **Não** | Cobrança por template: ~US$0,0068 por mensagem utility no Brasil **[S, fontes secundárias]**, ver [Meta](https://developers.facebook.com/docs/whatsapp/pricing). O compartilhamento por link que já existe continua grátis. |
| Redis (Upstash Free: 500K comandos/mês, 250 MB, 10 GB **[F]**, [pricing](https://upstash.com/pricing/redis)) | Sim, mas **desnecessário** | Uma instância e tráfego baixo. O cache de ranking com TTL de 1 h sai do plano até haver medição de lentidão. |
| Sentry e monitoramento | Opcional | Logs do Render e da Vercel (1 h no Hobby **[F]**) bastam no início. |

---

## 11. Fases (um PR pequeno por fase, nesta ordem)

Cada PR roda `pnpm turbo run check-types lint test build` e passa pelo `birdie-verifier` e pelo `birdie-reviewer`.

**Fase 0: decisões em docs**

- **Muda:** só docs.
  - Este arquivo.
  - `ESPECIFICACAO_COMPLETA.md` (Clerk → Better Auth, Redis fora, infra: Vercel, Render, Neon; sem Railway, Cloudinary ou Uploadthing).
  - `PROGRESS.md` (a diretriz passa a prever a build online; linhas de Clerk, Redis e gestão de usuários).
- **Pronto quando:** a spec e o PROGRESS não contradizem o plano.
- **Risco:** nenhum.

**Fase 1a: minimização de dados (schema)**

- **Muda:** migration que cria `athletes.birth_year` (integer, preenchido a partir de `birth_date`) e remove `birth_date`, `email` e o índice `athletes_email_unique`. API, validators, importações (CSV de atletas, planilha de torneio: o atleta passa a ser reconhecido pelo nome, com o clube para desempatar), formulário e telas de atleta, seed e testes.
- **Banco:** `pnpm db:backup` antes do `db:migrate` local (a remoção de colunas apaga os e-mails e as datas completas).
- **Docs:** spec (dados pessoais, tabela `athletes`, importação), `PROGRESS.md`.
- **Pronto quando:** nenhuma rota, tela, exportação ou importação lê ou grava e-mail ou data completa; gates e E2E verdes.

**Fase 1: endurecimento de produção (código, sem schema)**

- **Muda:**
  - C2 (subida recusa `DEV_ADMIN_MODE` ou falta de PIN em produção, PIN ≥ 16 em produção), com teste.
  - C3 (`TRUST_PROXY`), C4 (`CORS_ORIGINS` e SSE), C6 (proteção do seed).
  - `GET /health`; `@fastify/rate-limit`; cabeçalhos de segurança no `next.config.ts`.
  - Teste de não vazamento de dados pessoais nas rotas públicas.
- **Docs:** `apps/api/.env.example`; spec (CORS e modos admin).
- **Pronto quando:** os testes HTTP (`admin-guard.http.test.ts`) cobrem CORS negado para origem fora da lista, 429 no login e recusa de subida; o E2E continua verde sem mudanças.
- **Risco:** E2E quebrar se o padrão de CORS fora de produção mudar (manter `true`).

**Fase 2: sessão PIN que sobrevive a reinício**

- **Muda:** C1 (token HMAC) em `admin-session.ts`, com testes em `admin-session.test.ts` (prazo, assinatura adulterada, troca de PIN revoga).
- **Docs:** spec (modos admin).
- **Pronto quando:** reiniciar a API mantém o admin logado; trocar o PIN derruba as sessões.
- **Risco:** perde-se a revogação individual (documentar).

**Fase 3: infraestrutura e primeiro deploy (sem dados reais)**

- **Muda:** contas Neon, Render e Vercel; job `deploy-api`; `.node-version` (20); nova seção "Produção" em `docs/SETUP.md` (variáveis, deploy, runbook).
- **Banco:** primeiro deploy com `db:migrate` num banco vazio e um tenant criado à mão.
- **Pronto quando**, em produção:
  - páginas públicas abrem;
  - SSE ao vivo entre dois aparelhos (operador e telão);
  - login com PIN;
  - CSV baixa com nome certo;
  - og:image com URL absoluta do domínio;
  - PWA instalável;
  - QR do telão aponta para o domínio;
  - pedido de suporte da Vercel respondido.
- **Risco:** cold start; `TRUST_PROXY` errado (medir).

**Fase 4: dados e backup**

- **Muda:** migração dos dados locais (§7); repositório privado de backup com `age`; ensaio de restauração num branch do Neon. Docs: runbook em `SETUP.md`, `PROGRESS.md`.
- **Pronto quando:** um backup da nuvem é restaurado num branch com contagens iguais; o primeiro backup agendado roda sozinho.
- **Risco:** chave `age` perdida = backups inúteis (guardar em dois lugares).

**Fase 5: segurança e LGPD**

- **Muda:** religar `ENABLE_CODE_SECURITY_REVIEW` (§6, item 7, com aprovação do usuário); página `/privacidade` (Server Component, coberta pelo spec WCAG); Dependabot.
- **Docs:** `CLAUDE.md`, `SETUP.md`, `PROGRESS.md`.
- **Pronto quando:** página publicada com texto revisado pela federação; dívida fechada.

**Fase 6: identidade com Better Auth (subdividir)**

- **6a:** tabelas do Better Auth via `db:generate` (revisar o SQL); rota `/api/auth/*`; guard por sessão e papel; tela de login; o PIN sai.
- **6b:** `actor_user_id` (histórico) e `reviewed_by`/`reviewed_at` (inscrições) como colunas novas anuláveis (expand).
- **6c:** gestão de usuários e papéis.
- **Docs:** spec (auth, papéis, histórico), `docs/api/tournament-registrations.md`, `PROGRESS.md`.
- **Pronto quando:** o E2E cobre login, 403 por papel e "quem" visível no histórico.
- **Risco:** o E2E hoje depende de `DEV_ADMIN_MODE`. Manter esse modo só fora de produção, ou criar usuário de teste na fixture.

**Fase 7 (opcional): Web Push e e-mail**

- **Muda:** tabela de assinaturas, `web-push` e chaves VAPID em env; e-mail só se houver domínio verificado. Docs: spec (notificações), `PROGRESS.md`.

---

## 12. Riscos, cotas e plano de saída

| # | Risco | O que acontece | Mitigação e saída |
|---|---|---|---|
| R1 | Vercel considerar o uso comercial | Conta pausada | Resposta escrita do suporte. Saída: o web vai para o Render (segundo serviço; as 750 h são compartilhadas, então o web hiberna), para a VM Oracle, ou para o Vercel Pro (US$20 por usuário/mês **[F]**). |
| R2 | Estourar a cota do Hobby | Recurso pausado até 30 dias **[F]** | Cache de og:image já existe. Páginas `force-dynamic` gastam pouca CPU ativa (a espera de I/O não conta **[F]**). |
| R3 | Render: hibernação, reinício, keep-alive malvisto | 1 min de espera; streams caem e reconectam | §4.4. Saída: Koyeb (mesmo modelo, hiberna após 1 h) ou VM Oracle. |
| R4 | Render: 750 h esgotadas | API suspensa até o mês seguinte **[F]** | Um serviço só no workspace. |
| R5 | Neon: 100 CU-h, 5 GB de egress, 1 GB de armazenamento | Compute suspenso ou escrita bloqueada até o próximo ciclo **[F]** | Health sem banco; compute máximo baixo; acompanhar o painel. Saída: plano pago do Neon **[S, preço não conferido]** ou Postgres na VM. |
| R6 | Mudança de plano grátis (Koyeb, agora da Mistral; Oracle reduziu o A1 para 2 OCPU e 12 GB **[F]**) | Precisa migrar | Tudo é portátil: Postgres comum (`pg_dump`), API Node comum, Next com `next start`. A saída é sempre a VM com `docker compose`. |
| R7 | Perda de dados | — | Backup diário cifrado, PITR de 6 h, ensaio mensal. |
| R8 | Vazamento de dados pessoais | Incidente LGPD | Teste de não vazamento, `publicAthleteColumns`, guard, backups cifrados, repositório de backup privado. |
| R9 | Força bruta no PIN | Escrita indevida | PIN ≥ 16, rate limit, `trustProxy` correto. Fase 6 troca por contas individuais. |

**O que exigiria pagar no futuro:** domínio próprio (se a federação não tiver), WhatsApp oficial, várias instâncias da API (aí LISTEN/NOTIFY e um plano pago), banco acima de 1 GB ou de 100 CU-h, retenção de logs, e o Vercel Pro se o Hobby for negado.

**Não verificado** (marcado [S] no texto): preços pagos; comportamento real do Render com SSE; número de saltos do proxy do Render (`TRUST_PROXY`); licença MIT e plugins bearer/admin do Better Auth; pre-deploy do Render no grátis; minutos de Actions em repositório privado; detalhes da Brevo.

---

## 13. Fontes (consultadas em 14/11/2026)

- Vercel: [Hobby](https://vercel.com/docs/plans/hobby), [Fair use](https://vercel.com/docs/limits/fair-use-guidelines), [Termos](https://vercel.com/legal/terms), [comunidade: organização sem fins lucrativos](https://community.vercel.com/t/hobby-plan-eligibility-for-a-volunteer-built-internal-portal-for-a-non-profit-ieee-student-branch/51181)
- Render: [Free](https://render.com/docs/free), [changelog sobre WebSocket](https://render-web.onrender.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages)
- Neon: [Pricing](https://neon.com/pricing), [Regiões](https://neon.com/docs/introduction/regions), [São Paulo GA](https://neon.com/docs/changelog/2025-02-28)
- Supabase: [Pricing](https://supabase.com/pricing)
- Koyeb: [FAQ de preços](https://www.koyeb.com/docs/faqs/pricing), [Blog](https://www.koyeb.com/blog/sustaining-free-compute-in-a-hostile-environment)
- Fly.io: [Pricing](https://docs.fly.io/about/pricing)
- Railway: [Pricing](https://railway.com/pricing)
- Google Cloud Run: [Pricing](https://cloud.google.com/run/pricing)
- Cloudflare: [Limites do Workers](https://developers.cloudflare.com/workers/platform/limits/)
- Netlify: [Pricing](https://www.netlify.com/pricing/)
- Oracle: [Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)
- Clerk: [Pricing](https://clerk.com/pricing), [Deploy na Vercel](https://clerk.com/docs/guides/development/deployment/vercel.md)
- Better Auth: [Drizzle](https://www.better-auth.com/docs/adapters/drizzle), [Fastify](https://www.better-auth.com/docs/integrations/fastify)
- GitHub: [Baixar artefatos](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), [Desativar workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows), [nightly.link](https://nightly.link/)
- E-mail: [Resend](https://resend.com/pricing); Brevo por fontes secundárias (ex.: [dev.to](https://dev.to/techsifted/brevo-pricing-2026-every-plan-explained-with-the-hidden-costs-4oe3))
- Redis: [Upstash](https://upstash.com/pricing/redis)
- WhatsApp: [Meta](https://developers.facebook.com/docs/whatsapp/pricing), [Courier](https://www.courier.com/guides/whatsapp-pricing)
- Next.js local: `apps/web/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:158-166`
