# BirdieAtlas — Fluxo de trabalho

Como uma mudança sai da ideia e chega na `main`. As regras técnicas ficam no [`CLAUDE.md`](CLAUDE.md) e na [especificação](docs/ESPECIFICACAO_COMPLETA.md); este arquivo só define a ordem dos passos e quem faz o quê.

```
issue/ideia → branch → spec → plano → teste → código → gates locais
   → birdie-verifier → birdie-reviewer → PR → CI (verify + e2e) → merge → limpeza
```

## 0. Escolha a trilha

| Trilha | Quando | Passos obrigatórios |
|---|---|---|
| **Rápida** | Texto, doc, ajuste de estilo sem mudar comportamento, dependência de dev | 1, 5 (só `pnpm turbo run check-types lint test build`), 8, 9 |
| **Normal** | Bug ou feature que muda comportamento de uma camada (API **ou** web) | Todos, E2E só da área tocada |
| **Completa** | Schema, contrato da API, ciclo de vida do torneio, chave, ranking, privacidade ou UI nova | Todos, E2E completo e spec WCAG |

Na dúvida, suba de trilha.

## 1. Comece da `main` atualizada

```bash
git switch main
git pull --ff-only
git switch -c <tipo>/<assunto-curto>
```

- Tipos: `feat/`, `fix/`, `docs/`, `chore/`, `test/`, `refactor/`. Pacotes para `--filter`: `@birdie-atlas/api`, `web`, `@birdie-atlas/validators`, `@birdie-atlas/e2e`. Assunto em inglês, kebab-case (ex.: `feat/tiebreak-criteria`).
- Uma branch = um assunto = um PR. Achou outro problema no caminho? Anote no `PROGRESS.md` (Dívidas técnicas) ou abra outra branch.
- Branch com mais de alguns dias: `git rebase main` antes de abrir o PR.

## 2. Leia antes de mexer

1. Item correspondente no [`PROGRESS.md`](PROGRESS.md).
2. Seção relevante da [especificação](docs/ESPECIFICACAO_COMPLETA.md) (contratos, regras de negócio, convenções).
3. Mudança no web: `apps/web/AGENTS.md` e o guia do Next.js 16 em `node_modules/next/dist/docs/`.

Se a mudança altera contrato, regra ou schema, **escreva primeiro a alteração na especificação** (ou em `docs/api/<assunto>.md` para contratos grandes). Ela vira o critério de aceite do PR.

## 3. Planeje (trilhas normal e completa)

Escreva em 3 a 8 linhas, no PR ou no briefing do agente:

- O que muda e o que **não** muda.
- Camadas tocadas: `packages/validators` → `apps/api` (domain → services → routes) → `apps/web` → `apps/e2e`.
- Migration? Contrato novo? Tela nova?
- Como provar que funciona (teste unitário, cenário E2E, checagem manual).

Ordem de implementação recomendada, de dentro para fora:

1. Schema Zod em `packages/validators` (+ teste).
2. Regra pura em `apps/api/src/domain` (+ teste).
3. Schema do banco e migration, se houver (ver seção 4).
4. Service/rota na API (só orquestra).
5. Tela no web.
6. Spec E2E da jornada.

## 4. Implemente

- **Teste antes:** regra de domínio nova começa por um teste que falha (`pnpm --filter @birdie-atlas/api exec vitest` fica em modo watch).
- **Schema:** edite `apps/api/src/db/schema.ts` → `pnpm --filter @birdie-atlas/api db:generate` → **leia o SQL gerado** → `db:migrate`. Mudança destrutiva (renomear ou apagar coluna) vai em duas migrations: expandir, migrar dados, contrair (como `0001`/`0002` das inscrições). `db:push` nunca.
- **Banco local quebrado:** `db:reset` + `db:seed`. É descartável.
- **UI:** use `Field`, `ChoiceGroup`, `Tabs`, `Dialog`; trate carregamento, erro, vazio e sucesso; navegação só em `apps/web/src/lib/navigation.ts`.
- **Commits pequenos e frequentes** na branch, em Conventional Commits (`feat(api): ...`, `fix(web): ...`, `test(e2e): ...`). Cada commit deve compilar.

## 5. Gates locais

Rode do mais barato ao mais caro e pare no primeiro que falhar:

| Gate | Comando | Trilha |
|---|---|---|
| Tipos, lint e testes do pacote tocado | `pnpm turbo run check-types lint test --filter=<pacote>` | durante o trabalho |
| Pipeline do CI | `pnpm turbo run check-types lint test build` | todas |
| E2E da área | `pnpm e2e tests/<area>.spec.ts` | normal |
| E2E completo | `pnpm e2e` | completa |
| Acessibilidade | `pnpm --filter @birdie-atlas/e2e exec playwright test wcag --project=main` | UI nova ou alterada |

- E2E precisa do Postgres (`docker compose up -d`). Sem mudança no web desde o último build: `E2E_SKIP_BUILD=1` economiza minutos.
- Teste instável é falha: corrija a causa. Comportamento ainda não feito vira `test.fixme` com motivo.

## 6. Verificação independente (`birdie-verifier`)

Depois de cada mudança de comportamento, antes do commit final. Quem implementou não verifica.

Briefing mínimo:

```
Branch: <tipo>/<assunto>. Mudança: <1-3 linhas>. Critério de aceite: <seção da spec>.
Proibido: commit, push, troca de branch, db:push, tocar no banco birdie_atlas e nas portas 3000/3001.
Use o banco birdieatlas_e2e e as portas 3200/3201.
```

Resultado `FALHOU` ou `PASSOU COM RESSALVAS`: corrija, volte ao passo 5 e verifique de novo.

## 7. Revisão (`birdie-reviewer`)

Antes de abrir o PR, com o diff final (`git diff main...HEAD`). Corrija todo 🔴 e 🟡; 🔵 é opcional. Se corrigir algo que muda comportamento, volte ao passo 6.

## 8. Abra o PR

Antes de abrir, confira:

- [ ] `pnpm turbo run check-types lint test build` verde.
- [ ] E2E da trilha verde (ou `test.fixme` justificado).
- [ ] Especificação atualizada se mudou contrato, regra ou schema.
- [ ] `PROGRESS.md` atualizado (item concluído, aberto ou dívida nova) com a data.
- [ ] Migration revisada e reversível em dados (sem perda).
- [ ] Textos em português com acentuação; nenhum dado pessoal em endpoint público.
- [ ] `git status` limpo: sem `.env`, relatórios do Playwright ou arquivos temporários.

```bash
git push -u origin HEAD
gh pr create --base main --fill
```

Descrição do PR:

```markdown
## O quê
<1-3 linhas>

## Por quê
<item do PROGRESS.md ou problema>

## Como foi verificado
- pipeline: <ok>
- e2e: <specs rodadas>
- verifier: <PASSOU / ressalvas>
- reviewer: <veredito>

## Fora do escopo
<o que ficou para depois>
```

## 9. CI, merge e limpeza

- O CI roda `verify` e `e2e` em todo PR para `main`. Vermelho: baixe o artefato `playwright-report`, reproduza localmente e corrija na mesma branch.
- Merge só com CI verde. Use o merge commit do GitHub (padrão do histórico: `Merge pull request #N`).
- Depois do merge:

```bash
git switch main
git pull --ff-only
git branch -d <tipo>/<assunto>
git push origin --delete <tipo>/<assunto>
git fetch --prune
```

## Casos especiais

- **Hotfix:** branch `fix/` a partir da `main`, trilha normal, PR pequeno. Nunca commit direto na `main`.
- **Mudança só de contrato:** PR com a spec (ou `docs/api/<assunto>.md`) primeiro, implementação no PR seguinte. Foi assim com as inscrições (3a, 3b, 3c).
- **Trabalho paralelo:** use `git worktree add ../BirdieAtlas-<assunto> -b <branch>` em vez de trocar de branch com mudanças pendentes. Cada worktree precisa do próprio `pnpm install`.
- **Débito encontrado no caminho:** não conserte fora do escopo; registre em "Dívidas técnicas" do `PROGRESS.md`.
