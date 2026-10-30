# Skills do projeto

Skills de terceiros copiadas para o repositório na versão revisada. O Claude Code as carrega para quem abrir o projeto, sem instalação. Nenhuma tem scripts: são só Markdown.

Regra de precedência: o [`CLAUDE.md`](../../CLAUDE.md) e a [especificação](../../docs/ESPECIFICACAO_COMPLETA.md) vencem qualquer skill. Os conflitos conhecidos estão listados no `CLAUDE.md`, em "Skills e plugins".

| Skill | Origem | Commit / versão | Licença |
|---|---|---|---|
| `source-driven-development` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `eb07f19` | MIT |
| `deprecation-and-migration` | addyosmani/agent-skills | `eb07f19` | MIT |
| `api-and-interface-design` | addyosmani/agent-skills | `eb07f19` | MIT |
| `doubt-driven-development` | addyosmani/agent-skills | `eb07f19` | MIT |
| `documentation-and-adrs` | addyosmani/agent-skills | `eb07f19` | MIT |
| `frontend-ui-engineering` | addyosmani/agent-skills | `eb07f19` | MIT |
| `vercel-react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (`skills/react-best-practices`) | `1a2c79d` | MIT |
| `supabase-postgres-best-practices` | [supabase/agent-skills](https://github.com/supabase/agent-skills) | `c9be0e9` | MIT |
| `playwright-cli` | `playwright-core@1.64.1` (`lib/tools/skills/playwright-cli`), mesma versão do `@playwright/test` de `apps/e2e` | 1.64.1 | Apache-2.0 |

As skills da addyosmani citam arquivos de referência do repositório de origem (`../../references/...`) que não foram copiados; os links ficam quebrados de propósito.

## Atualizar

1. Clone o repositório de origem numa pasta temporária, fora deste repositório.
2. Leia o diff de cada `SKILL.md` e dos arquivos de referência contra a cópia daqui. Procure instruções dirigidas ao agente, comandos de rede e scripts novos.
3. Substitua a pasta, atualize o commit na tabela e abra PR (`chore/...`).
4. `playwright-cli`: copie de `node_modules/.pnpm/playwright-core@<versão>/node_modules/playwright-core/lib/tools/skills/playwright-cli` sempre que o `@playwright/test` subir de versão.

## Adicionar

Mesmo processo, com o motivo no PR. Não entra skill que repita regra do `CLAUDE.md`, que brigue com o design system ou que duplique um plugin já ligado em `.claude/settings.json`.
