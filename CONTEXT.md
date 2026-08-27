# BirdieAtlas — Contexto do Projeto

Este documento registra o estado atual do BirdieAtlas, decisões já tomadas e o objetivo das próximas etapas. Deve ser atualizado sempre que uma entrega relevante for concluída.

## Objetivo do produto

O BirdieAtlas é uma plataforma web para gestão de campeonatos de badminton. A solução deve permitir que federações e organizadores administrem atletas, clubes, torneios, categorias, inscrições, chaves, partidas e rankings, com páginas públicas para consulta posterior.

## Stack definida

- Frontend: Next.js 15, App Router, TypeScript em modo estrito e Tailwind CSS v4.
- Componentes: shadcn/ui como base visual.
- Estado de servidor: TanStack Query v5.
- Validação no cliente: Zod e schemas compartilhados.
- Backend: Node.js, Fastify, TypeScript estrito e API REST.
- Banco: PostgreSQL com Drizzle ORM.
- Monorepo: Turborepo.

## Estrutura principal

- `apps/web`: frontend Next.js.
- `apps/api`: Fastify, Drizzle e rotas REST.
- `packages/types`: tipos compartilhados.
- `packages/validators`: schemas Zod compartilhados.
- `packages/config`: configurações compartilhadas.

## Estado atual

### Correção de rotas

Foi removida a estrutura antiga de route groups que gerava conflito de páginas resolvendo para o mesmo caminho `/dashboard`.

- Commit: `29678c00eee0e6a79c7e7e7d7c38f89d4ad0f28d`
- Mensagem: `fix: remove old route groups causing duplicate path error`

### Sidebar

A aplicação já possuía uma sidebar administrativa própria, renderizada por:

```text
apps/web/src/components/layout/app-shell.tsx
```

Uma sidebar adicional foi criada por engano em `apps/web/src/app/dashboard/layout.tsx`, causando duplicação visual. Esse layout adicional foi removido.

- Commit de remoção: `bfadf43b31531de6e953e46496d80b37fa75f208`
- Mensagem: `fix: remove duplicate dashboard sidebar`

Regra: não criar layouts ou sidebars novos para páginas administrativas. Todas as páginas do dashboard devem reutilizar o `AppShell` existente.

### Página de atletas

Foi criada uma primeira página de listagem de atletas:

```text
apps/web/src/app/dashboard/athletes/page.tsx
```

- Commit: `47be175136827744c8315700ea86fd85f1b84936`
- Mensagem: `feat: add athletes CRUD pages`

Observação: a implementação atual é inicial e ainda precisa ser alinhada integralmente à API, aos tipos compartilhados, ao cliente HTTP `apiFetch`, ao TanStack Query e aos componentes shadcn/ui.

### Página de torneios

Foi criada a página inicial de listagem:

```text
apps/web/src/app/dashboard/tournaments/page.tsx
```

- Commit: `925e8fff5339e349595e22d8c26091edf3d51ced`
- Mensagem: `feat(tournament): add tournaments listing page`

Ela contempla carregamento, erro, estado vazio, tabela responsiva, badges de status e links para criação e detalhes.

Pendência crítica: adicionar o item `Torneios` à sidebar existente em `apps/web/src/components/layout/app-shell.tsx`, apontando para `/dashboard/tournaments`. A alteração deve preservar todos os itens de navegação já existentes.

## Branch de trabalho

As alterações recentes estão na branch:

```text
feat/dashboard-crud-pages
```

Não enviar alterações diretamente para `main`. Quando a entrega estiver revisada, abrir Pull Request para a branch de destino definida pelo projeto.

## Convenções obrigatórias

### TypeScript

- `strict: true`.
- Não usar `any`; usar tipos específicos ou `unknown`.
- Usar `interface` para objetos públicos e `type` para composições.
- Usar valores `as const` no lugar de `enum` do TypeScript.

### Frontend

- Páginas do App Router são Server Components por padrão.
- Usar `'use client'` apenas quando houver estado, eventos, efeitos ou TanStack Query.
- Preferir `apiFetch` em `apps/web/src/lib/api.ts`; não usar `fetch` cru se o cliente HTTP já suportar a necessidade.
- Usar TanStack Query para dados da API.
- Usar schemas Zod de `packages/validators` para formulários.
- Reutilizar componentes de `components/ui` e `components/shared`.
- Nunca introduzir uma segunda sidebar ou um segundo shell administrativo.
- Usar UTF-8 e preservar acentos em português em todos os arquivos.

### Backend

- Validar todo input com Zod antes da lógica de negócio.
- Erros: `{ error: string, code?: string, details?: unknown }`.
- Listas: `{ data, pagination }`.
- Registros de negócio usam soft delete quando aplicável.
- Não expor CPF, e-mail ou telefone em endpoints públicos.

### Banco de dados

- Fonte única do schema: `apps/api/src/db/schema.ts`.
- Em desenvolvimento: `pnpm --filter api db:push`.
- Em produção: `pnpm --filter api db:generate` e `pnpm --filter api db:migrate`.

### Git

- Conventional Commits.
- Branches no padrão `feat/phase-X-nome-da-feature` ou `fix/descricao-do-bug`.
- Nunca commitar diretamente na `main`.

## Próxima etapa: Torneios

A prioridade atual é completar o módulo administrativo de torneios de forma incremental e integrada à API existente.

### Etapa 1 — Navegação

Objetivo: tornar a listagem de torneios acessível pela sidebar existente.

- Atualizar `apps/web/src/components/layout/app-shell.tsx`.
- Adicionar um único item `Torneios` com rota `/dashboard/tournaments`.
- Usar o padrão visual e o ícone já adotados pelo menu atual.
- Preservar todos os links já existentes.

### Etapa 2 — Listagem alinhada à API

Objetivo: revisar `dashboard/tournaments/page.tsx` para o contrato real do endpoint.

- Confirmar formato de retorno de `GET /tournaments`.
- Usar `apiFetch` e TanStack Query.
- Usar os tipos compartilhados quando disponíveis.
- Exibir paginação conforme o contrato da API.
- Tratar estados de carregamento, erro e vazio.

### Etapa 3 — Criar torneio

Objetivo: implementar `/dashboard/tournaments/new`.

Campos esperados, sujeitos ao schema real:

- Nome.
- Slug.
- Nível.
- Data de início.
- Data de término.
- Local.
- Status inicial.

Critérios:

- Formulário com componentes shadcn/ui.
- Validação Zod no cliente e no endpoint.
- Slug gerado/validado de forma consistente.
- Sucesso redireciona para a listagem ou detalhe criado.
- Exibir mensagens de erro compreensíveis.

### Etapa 4 — Detalhe do torneio

Objetivo: implementar `/dashboard/tournaments/[tournamentId]` ou o identificador já definido no projeto.

Deve exibir:

- Dados gerais e status do torneio.
- Categorias do torneio.
- Quantidade de inscrições por categoria.
- Atalhos para inscrições, chaves e partidas quando essas telas existirem.
- Ações compatíveis com o status do torneio.

### Etapa 5 — Edição e ciclo de vida

Objetivo: permitir editar dados permitidos e controlar transições de status.

- Implementar edição sem alterar campos bloqueados após determinadas fases, conforme regras futuras.
- Preparar ações para publicar, iniciar, concluir e cancelar torneios.
- Registrar operações críticas com transação no backend quando necessário.

### Etapa 6 — Categorias e inscrições

Objetivo: suportar disciplinas MS, WS, MD, WD e XD dentro de cada torneio.

- Criar categorias.
- Configurar limites, regras e datas de inscrição.
- Registrar inscrições de atletas e duplas.
- Validar elegibilidade no backend.

## Backlog posterior

Após o módulo de torneios, seguir nesta ordem aproximada:

1. Completar atletas, clubes, duplas e afiliações.
2. Motor de rankings e regras de pontos.
3. Geração de chaves com seeding e formatos previstos.
4. Fluxo de partidas, placares e progressão.
5. Páginas públicas de atleta, torneio e ranking.
6. Autenticação Clerk e middleware de roles.
7. Uploads, e-mails, observabilidade e testes E2E.

## Critério de pronto para cada entrega

Uma funcionalidade só deve ser considerada concluída quando:

- A rota está acessível pela navegação correta.
- Não cria rotas, layouts ou menus redundantes.
- Está alinhada ao schema e ao contrato real da API.
- Valida dados no cliente e no servidor quando aplicável.
- Trata carregamento, erro, vazio e sucesso.
- Passa TypeScript estrito, lint e build.
- Foi revisada quanto a acentuação UTF-8 e textos em português.
- Foi enviada em commit com mensagem Conventional Commit adequada.
