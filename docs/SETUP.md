# BirdieAtlas — Instalação em máquina nova (roteiro para agente)

Roteiro para um agente de código (Claude Code) preparar uma máquina do zero até o ponto de "pronto para mexer". Pensado para Windows 11; diferenças de macOS e Linux estão no fim de cada passo.

## Como usar

Na máquina nova, abra o Claude Code numa pasta qualquer (por exemplo `~/dev`) e cole:

```
Clone https://github.com/hiraokagabriel/BirdieAtlas.git nesta pasta (se ainda não existir)
e siga docs/SETUP.md do repositório à risca, passo a passo. Pare e me pergunte quando o
roteiro mandar. No fim, me entregue o relatório pedido no passo 10.
```

Se o Git ainda não estiver instalado, o agente não consegue clonar: instale o Git primeiro (passo 1) e depois cole o pedido.

## Regras para o agente

- Siga os passos em ordem. Cada passo começa conferindo se já está feito; se estiver, pule. O roteiro pode ser rodado de novo sem estragar nada.
- Pare e pergunte ao usuário antes de: instalar o Docker Desktop, reiniciar a máquina, parar qualquer processo que já ocupe as portas 3000, 3001, 3200, 3201 ou 5432, ou apagar qualquer coisa fora da pasta do repositório.
- Comandos interativos (`gh auth login`, instaladores que pedem admin) são do usuário: peça para ele rodar com `! <comando>`.
- Não faça commit, push nem troque de branch. Não rode `db:push`. Não edite arquivos versionados: se algo do roteiro estiver errado, anote no relatório.
- Não leia nem mostre o conteúdo de `.env` além das chaves listadas aqui.
- Falhou um comando: leia o erro, tente a correção indicada no passo e, se não houver, pare e relate com a saída relevante.

## 1. Ferramentas do sistema

Confira cada uma e instale só o que faltar.

| Ferramenta | Conferir | Instalar (Windows) |
|---|---|---|
| Git | `git --version` | `winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements` |
| GitHub CLI | `gh --version` | `winget install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements` |
| Node.js | `node --version` | ver abaixo |
| Docker | `docker --version` e `docker compose version` | **pergunte antes:** `winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements` |

**Node.js:** use a mesma versão maior do CI (`node-version` em `.github/workflows/ci.yml`). Se a instalada for diferente, instale a certa com `winget install --id OpenJS.NodeJS.<versão> -e` (ex.: `OpenJS.NodeJS.20`) ou, se o usuário usa `nvm`/`fnm`, por eles.

**Docker Desktop** exige WSL 2 e costuma pedir reinício. Depois de instalar: peça ao usuário para abrir o Docker Desktop, aceitar os termos e reiniciar se for pedido; espere `docker info` responder sem erro antes de seguir.

Depois de instalar qualquer coisa, abra um terminal novo (ou peça ao usuário para reiniciar o Claude Code) para o `PATH` atualizar.

macOS: `brew install git gh node@<versão>` e Docker Desktop pelo site ou `brew install --cask docker`. Linux: pacotes da distribuição, Docker Engine com o plugin `compose`.

## 2. pnpm

O repositório fixa a versão em `packageManager` do `package.json` raiz.

```bash
corepack enable
pnpm --version
```

`pnpm --version` deve bater com a versão maior do `packageManager`. Se `corepack enable` falhar por permissão no Windows, use `npm install -g pnpm@<versão do packageManager>`.

## 3. Git e GitHub

```bash
git config --global user.name
git config --global user.email
gh auth status
```

- Nome ou e-mail vazio: pergunte ao usuário quais usar e configure com `git config --global`.
- `gh` sem login: peça ao usuário para rodar `! gh auth login` (GitHub.com, HTTPS, navegador) e depois `gh auth setup-git`.
- Windows: `git config --global core.autocrlf true` se ainda não estiver definido, para não gerar diffs só de fim de linha.

## 4. Código

Se a pasta `BirdieAtlas` não existir:

```bash
gh repo clone hiraokagabriel/BirdieAtlas
cd BirdieAtlas
```

Se existir, entre nela e confira `git status`: com mudanças locais, não mexa e avise o usuário; limpa, rode `git switch main` e `git pull --ff-only`.

Todos os passos seguintes rodam na raiz do repositório.

## 5. Variáveis de ambiente

Copie só se o destino não existir (nunca sobrescreva um `.env` já presente):

| Origem | Destino |
|---|---|
| `apps/api/.env.example` | `apps/api/.env` |
| `apps/web/.env.example` | `apps/web/.env.local` |

Confira que `apps/api/.env` tem `DEFAULT_TENANT_SLUG=fpb-sp` e `DEV_ADMIN_MODE=true`. Os valores padrão já apontam para o Postgres do `docker-compose.yml` (`postgres:postgres@127.0.0.1:5432/birdie_atlas`).

## 6. Banco de dados

1. Confira se a porta 5432 está livre (`netstat -ano | findstr :5432` no Windows; `lsof -i :5432` no macOS/Linux). Ocupada por outro Postgres: **pare e pergunte**.
2. Suba o container e espere ficar pronto:

```bash
docker compose up -d
docker compose exec postgres pg_isready -U postgres
```

Repita o `pg_isready` a cada poucos segundos (até ~60 s) até responder `accepting connections`.

## 7. Dependências e build inicial

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@birdie-atlas/validators
```

O build do `validators` gera o `dist` que a API e os scripts do banco importam em tempo de execução.

## 8. Migrations e dados de exemplo

```bash
pnpm --filter @birdie-atlas/api db:migrate
pnpm --filter @birdie-atlas/api db:seed
```

Se o banco local já existia com dados velhos ou migrations divergentes, use `pnpm --filter @birdie-atlas/api db:reset` e depois `db:seed`. O banco local é descartável, mas confirme com o usuário antes se ele já tinha trabalhado nesta máquina.

## 9. Verificação

1. **Pipeline do CI:**

   ```bash
   pnpm turbo run check-types lint test build
   ```

   Tudo verde. Falta de memória no build: repita com `--concurrency=2`.

2. **Servidores de desenvolvimento:** rode `pnpm dev` em segundo plano e confira:

   - `curl -s http://localhost:3001/tournaments` devolve JSON com `data` e `pagination`.
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` devolve `200` (no Windows use `curl.exe`).

   Depois, pare o `pnpm dev` que você iniciou.

3. **E2E:** instale o Chromium do Playwright e rode a suíte (leva alguns minutos; usa banco `birdieatlas_e2e` e portas 3200/3201, sem tocar no banco de desenvolvimento):

   ```bash
   pnpm e2e:install
   pnpm e2e
   ```

   Linux: se o Chromium reclamar de bibliotecas, use `pnpm --filter @birdie-atlas/e2e exec playwright install --with-deps chromium`.

## 10. Claude Code e relatório

O projeto traz o próprio ferramental do Claude Code; nada disso é instalado à mão:

- **Plugins** (`.claude/settings.json`): ao abrir o projeto, o Claude Code registra os marketplaces e pede para instalar os plugins. Avise o usuário para **aceitar a instalação e reiniciar o Claude Code** depois. Confira com `/plugin` que todos aparecem como ativos.
- **Skills** (`.claude/skills/`): já vêm com o repositório e carregam sozinhas. Confira que `vercel-react-best-practices`, `supabase-postgres-best-practices` e `playwright-cli` aparecem na lista de skills da sessão.
- **Agentes** (`.claude/agents/`): `birdie-verifier` e `birdie-reviewer`, também automáticos.

Requisitos de plugins específicos:

- **`security-guidance`** precisa de Python 3.8+ no `PATH` (`python --version` ou `py -3 --version`). Faltando no Windows: `winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements`. Só os avisos por padrão (regex, sem custo) ficam ligados: as revisões por LLM (fim de turno, commit e push) estão desligadas pelo projeto com `ENABLE_CODE_SECURITY_REVIEW=0` em `.claude/settings.json`, e com elas o plugin também não instala o Agent SDK. Para religar quando o projeto for para a internet, apague essa variável do `env` do `settings.json`.
- **`context7`** conecta a um servidor MCP remoto e pode pedir autenticação no primeiro uso: o usuário faz pelo navegador.
- **`playwright-cli`** não precisa de instalação: vem com o `@playwright/test` de `apps/e2e`. Confira com `pnpm --filter @birdie-atlas/e2e exec playwright cli --version` (deve mostrar a versão do `@playwright/test`).
- **`typescript-lsp`** precisa do servidor de linguagem global. Confira com `typescript-language-server --version`; faltando: `npm install -g typescript-language-server typescript`.

Plugins pessoais (estilo de resposta, segurança de shell etc.) não fazem parte do projeto: o usuário instala com `/plugin` se quiser. Não instale por conta própria.
- Antes de qualquer mudança no código, leia [`CLAUDE.md`](../CLAUDE.md) e [`workflow.md`](../workflow.md).

Relatório final, curto:

- Versões instaladas: Git, gh, Node, pnpm, Docker.
- O que já existia e o que foi instalado ou criado (incluindo os `.env` copiados).
- Resultado de cada verificação do passo 9 (pipeline, API, web, E2E), com o número de testes.
- Pendências do usuário (login, reinício, plugins) e qualquer passo deste roteiro que estava errado ou desatualizado.
