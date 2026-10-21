# BirdieAtlas — Especificação

> Fonte de verdade do projeto. Descreve o sistema como ele é e as regras que todo código novo segue.
> O andamento das entregas fica em [`PROGRESS.md`](../PROGRESS.md); as decisões do redesign e o motivo delas, em [`REDESIGN.md`](REDESIGN.md).
> Toda mudança de comportamento, contrato ou regra atualiza este documento no mesmo PR.

## Visão geral

BirdieAtlas é uma plataforma web para gestão de campeonatos de badminton, voltada a federações e organizadores. Cobre atletas, clubes, duplas, torneios, categorias, inscrições, chaves, partidas e rankings, com páginas públicas para consulta.

Objetivos:

1. Gerenciar atletas, clubes, afiliações e duplas.
2. Organizar torneios com categorias e inscrições.
3. Gerar chaves e registrar resultados.
4. Calcular rankings a partir dos resultados.
5. Publicar torneios, rankings, atletas e clubes num portal público.

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web (`apps/web`) | Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind CSS v4, componentes shadcn/ui sobre `radix-ui`, TanStack Query v5 |
| API (`apps/api`) | Node.js, Fastify 5, TypeScript estrito, Zod, Drizzle ORM 0.41 |
| Banco | PostgreSQL 16 (Docker local, porta 5432, banco `birdie_atlas`) |
| Testes | Vitest (API, web e pacotes) |
| CI | GitHub Actions: typecheck, lint, testes e build em todo push e PR para `main` |

O Next.js 16 tem APIs e convenções diferentes das versões anteriores. Antes de escrever código web, consulte o guia em `node_modules/next/dist/docs/` (ver `apps/web/AGENTS.md`).

## Estrutura do repositório

```
apps/
  api/
    drizzle/              migrations geradas (histórico começa em 0000_baseline.sql)
    src/
      db/                 schema.ts (fonte única do schema), index.ts, public-columns.ts
      domain/             regras puras e testadas (chave, paginação, inscrições)
      http/errors.ts      handler único de erros
      middleware/         admin-guard (modo admin de desenvolvimento)
      routes/             uma rota Fastify por recurso
      scripts/            reset-db.ts, seed.ts
      tenant.ts           tenant padrão do servidor
  web/
    src/
      app/(public)/       portal público
      app/admin/          área administrativa
      components/         ui/ (shadcn), shared/ e pastas por domínio
      lib/api.ts          apiFetch e ApiError
      lib/navigation.ts   fonte única da navegação
      providers/          QueryProvider
packages/
  validators/             schemas Zod e regras compartilhadas entre API e web
  types/                  tipos compartilhados
  ui/, eslint-config/, typescript-config/
docs/                     especificação, redesign e contratos de API
```

## Rotas web

Admin, sob `/admin`, identificando registros por `id`:

| Rota | Conteúdo |
|---|---|
| `/admin` | Dashboard com dados reais da API |
| `/admin/athletes` | Atletas, cadastro e importação |
| `/admin/pairs` | Duplas |
| `/admin/clubs`, `/admin/clubs/[clubId]` | Clubes |
| `/admin/tournaments`, `/admin/tournaments/[tournamentId]` | Torneios; o detalhe tem as abas Inscrições, Chaveamento, Agenda e Configurações |
| `/admin/rankings`, `/admin/rankings/[rankingId]` | Rankings e regras de pontos |

Público, identificando por slug:

| Rota | Conteúdo |
|---|---|
| `/` | Landing |
| `/t/[slug]` | Torneio |
| `/r/[tenantSlug]` | Rankings da federação |
| `/a/[athleteId]` | Perfil do atleta |
| `/c/[clubSlug]` | Clube |

A navegação existe só para admin e público e vem de `apps/web/src/lib/navigation.ts`. Um teste garante que todo `href` da navegação tem uma rota. Papéis de atleta, juiz e super-admin ganham navegação quando suas páginas existirem.

## Contratos da API

A API roda em `http://localhost:3001`, sem prefixo `/api`. O web a chama direto do navegador, então o CORS precisa liberar `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE` e `OPTIONS` (o padrão do `@fastify/cors` libera só `GET`, `HEAD` e `POST`, e o navegador bloquearia toda escrita que não é `POST`). Teste de escrita com `curl` não pega esse problema: confira no navegador.

### Erros

Todo erro tem o formato `{ error: string, code?: string, details?: unknown }`, produzido por um único handler (`apps/api/src/http/errors.ts`):

- Falha de Zod vira `400 VALIDATION_ERROR`, com `details`.
- Erros de cliente do Fastify mantêm o status.
- Violação de índice único vira `409 UNIQUE_VIOLATION`.
- O resto vira `500 INTERNAL_ERROR`, sem expor a mensagem interna.

No web, `apiFetch` lança `ApiError { status, code, message, details }`.

### Paginação

Coleções de topo (`athletes`, `clubs`, `tournaments`, `pairs`, `rankings`, `tenants` e entradas de ranking) devolvem `{ data, pagination: { page, pageSize, total, totalPages } }`. `page` começa em 1, `pageSize` tem padrão 25 e máximo 100.

Listas filhas de um recurso (partidas de uma chave, inscrições de uma categoria, categorias de um torneio, regras de pontos, afiliações) voltam completas, porque paginar uma chave a quebraria.

### Autorização

- Toda escrita (POST, PUT, PATCH, DELETE) exige modo admin, verificado por um hook global `onRequest` (`apps/api/src/middleware/admin-guard.ts`). Autorização nunca é checada dentro do handler.
- Leituras que devolvem dados pessoais (`GET /athletes`, `GET /athletes/:id`) também exigem modo admin.
- Enquanto o Clerk não está integrado, o modo admin vem de `DEV_ADMIN_MODE=true` ou de `PATCH /dev/admin-mode`. Essa rota só existe fora de produção; em produção nenhuma escrita é possível.

### Dados pessoais

CPF, e-mail, telefone e data de nascimento são dados pessoais. Endpoints públicos nunca os devolvem: usam `publicAthleteColumns` (`apps/api/src/db/public-columns.ts`). Logs não registram dados pessoais.

### Busca pública de atletas

`GET /athletes/search?q=` é público (não exige modo admin) e alimenta a busca da home. `q` é aparado e tem de 2 a 80 caracteres; fora disso, `400 VALIDATION_ERROR`. `page` (padrão 1) e `pageSize` (padrão 10, máximo 25). A resposta é `{ data, pagination }`, ordenada por nome, com apenas campos públicos: `id`, `name`, `gender`, `nationality`, `photoUrl`, `active`, `clubName` e `clubSlug` (clube ativo no tenant padrão, `null` sem vínculo). Nunca devolve e-mail, CPF, telefone nem data de nascimento. Atletas excluídos (`deletedAt`) ficam de fora; inativos aparecem, como no perfil público.

A busca ignora caixa e acentos ("jose" encontra "José") com `lower` e `translate` do Postgres, sem extensão, para as letras acentuadas do português. Vários termos separados por espaço (até 5) precisam aparecer todos no nome, em qualquer ordem. `%`, `_` e `\` do usuário são escapados e valem como texto. A regra mora em `apps/api/src/domain/athlete-search.ts`. A rota é estática e o Fastify a prioriza sobre `/athletes/:id`.

### Tenant

O servidor aplica um tenant padrão em todas as consultas e escritas: `DEFAULT_TENANT_SLUG`, ou o único tenant cadastrado. `tenantId` enviado pelo cliente é ignorado. Atletas são globais (identidade entre federações); o vínculo com o tenant é a afiliação. O seletor de tenant chega com as organizações do Clerk.

### Endpoints

| Recurso | Endpoints |
|---|---|
| Atletas | `GET/POST /athletes`, `GET/PUT/DELETE /athletes/:id`, `GET /athletes/search` (público), `GET /athletes/:id/profile` (público), `POST /athletes/import-csv`, `POST /import/athletes`, `GET /import/athletes/template-columns` |
| Afiliações | `GET/POST /athletes/:athleteId/affiliations`, `PATCH/DELETE /affiliations/:id` |
| Clubes | `GET/POST /clubs`, `GET/PUT/DELETE /clubs/:id`, `GET /clubs/by-slug/:slug`, `GET /clubs/:id/profile` |
| Duplas | `GET/POST /pairs`, `GET/PUT/DELETE /pairs/:id` (desativar é `PUT { active: false }`) |
| Torneios | `GET/POST /tournaments`, `GET/PUT/DELETE /tournaments/:id`, `GET /tournaments/by-slug/:slug`, `GET /tournaments/:id/public-summary`, `POST /tournaments/:id/transition`, `POST /tournaments/:id/finalize`, `POST /tournaments/:id/reopen` |
| Categorias | `GET/POST /tournaments/:id/categories` |
| Inscrições | `GET /tournaments/categories/:categoryId/registrations` (público), `POST /tournaments/categories/:categoryId/register`, `GET /registrations/tournament/:tournamentId` (admin), `PATCH /registrations/:registrationId`, `POST /registrations/:registrationId/approve`, `DELETE /tournaments/registrations/:registrationId` |
| Chaves e partidas | `GET /tournaments/categories/:categoryId/draws`, `POST /draws/generate/:categoryId`, `POST /draws/:drawId/redraw`, `POST /draws/:drawId/publish`, `POST /draws/:drawId/unpublish`, `GET /draws/:drawId/matches`, `PATCH /draws/matches/:matchId/schedule`, `GET/POST /draws/matches/:matchId/result` |
| Agenda automática | `POST /tournaments/:id/schedule/auto` |
| Pontos e rankings | `POST /tournaments/:tournamentId/award-points`, `GET/POST /rankings`, `GET/PUT/DELETE /rankings/:rankingId`, `GET /rankings/:rankingId/entries`, `POST /rankings/:rankingId/recalculate`, `GET /rankings/:rankingId/tournaments`, `POST/DELETE /rankings/:rankingId/tournaments/:tournamentId`, `GET/POST /rankings/:rankingId/point-rules`, `POST /rankings/:rankingId/point-rules/bulk`, `PUT/DELETE /rankings/:rankingId/point-rules/:ruleId` |
| Tenants | `GET/POST /tenants`, `GET/PUT/DELETE /tenants/:id` |
| Dashboard | `GET /dashboard/stats`, `GET /dashboard/recent-matches`, `GET /dashboard/upcoming-matches` |

O contrato detalhado de inscrições está em [`api/tournament-registrations.md`](api/tournament-registrations.md).

## Modelo de dados

A fonte única do schema é `apps/api/src/db/schema.ts`. Toda tabela tem `id` (texto, UUID), `createdAt` e `updatedAt`.

Enums:

| Enum | Valores |
|---|---|
| `gender` | `M`, `F` |
| `discipline` | `MS`, `WS`, `MD`, `WD`, `XD` |
| `tournament_status` | `draft`, `registration_open`, `registration_closed`, `in_progress`, `completed`, `cancelled` |
| `tournament_level` | `local`, `regional`, `state`, `national`, `international` |
| `draw_type` | `single_elimination`, `round_robin`, `group_then_elimination` |
| `match_status` | `pending`, `in_progress`, `completed`, `walkover`, `retired` |
| `ranking_status` | `active`, `inactive`, `archived` |
| `registration_status` | `pending`, `approved`, `rejected` |

Tabelas:

| Tabela | Papel |
|---|---|
| `tenants` | Federação ou organização |
| `clubs` | Clube de um tenant; slug único |
| `athletes` | Atleta global; e-mail único |
| `athlete_affiliations` | Vínculo histórico atleta ↔ clube ↔ tenant (`startedAt`, `endedAt`) |
| `pairs` | Dupla de dois atletas numa disciplina |
| `tournaments` | Torneio de um tenant, com status, nível e `pointsAwarded`; slug único |
| `tournament_categories` | Categoria de um torneio: disciplina, formato, limite de inscrições, número de cabeças de chave |
| `tournament_registrations` | Inscrição numa categoria: `athleteId` (simples) XOR `pairId` (duplas, constraint `registrations_athlete_xor_pair`), seed, `status` e `notes`. Índices únicos parciais impedem o mesmo atleta ou dupla duas vezes na categoria (recusadas e excluídas não ocupam a vaga) |
| `draws` | Chave de uma categoria; `published` bloqueia o ressorteio |
| `matches` | Partida: `round`, `position`, duas inscrições, `nextMatchId`, status, agenda e quadra |
| `match_results` | Um registro por set |
| `rankings` | Ranking de um tenant por disciplina e ano, com `countBestResults` e `minTournamentsRequired`; slug único por tenant |
| `point_rules` | Pontos por colocação para um ranking, por nível (e opcionalmente disciplina), com multiplicador e bônus de participação |
| `ranking_tournaments` | Torneios que pontuam num ranking |
| `ranking_entries` | Posição calculada de um atleta ou dupla num ranking |

Soft delete (`deletedAt`) vale para atletas, clubes, torneios, categorias, inscrições, duplas, rankings, regras de pontos e vínculos ranking ↔ torneio. Registros de negócio nunca são apagados fisicamente, porque resultados e rankings dependem deles. Listas, buscas e a geração de chave ignoram excluídos; nomes em chaves e históricos continuam aparecendo. Colunas únicas usam índice único parcial `WHERE deleted_at IS NULL`. Restauração será só pela API; ainda não há rota para isso.

## Regras de negócio

### Atletas, clubes e duplas

- Um atleta tem no máximo um clube ativo por vez (`409 ACTIVE_AFFILIATION_EXISTS`). Afiliações são históricas: encerram com `endedAt`.
- Gênero por disciplina: `MS`/`MD` só masculino, `WS`/`WD` só feminino, `XD` um de cada. A API de inscrição valida a regra (`422 GENDER_INCOMPATIBLE`), a interface filtra os atletas, e `award-points` e o ranking continuam ignorando combinações incompatíveis. A regra mora em `apps/api/src/domain/eligibility.ts`.

### Ciclo de vida do torneio

```
draft → registration_open → registration_closed → in_progress → completed
```

- `cancelled` pode ser alcançado de qualquer estado antes de `completed`.
- A tabela de transições é única, em `packages/validators/src/tournament.ts`, usada pela API e pelo web. O status só muda pelo ciclo de vida, nunca por edição direta.
- `POST /tournaments/:id/transition { to }` faz as transições simples, com compare-and-set no status (`409 TOURNAMENT_STATUS_CHANGED` em corrida).
- Encerrar é `POST /finalize` (exige `in_progress` e gera o pódio). Reabrir é `POST /reopen` (`completed → in_progress`, reverte os pontos). A rota de transição responde `409 USE_DEDICATED_ENDPOINT` para esses dois casos.
- Torneio encerrado ou cancelado recusa inscrições novas (`409 TOURNAMENT_LOCKED`).

### Inscrições

- Uma inscrição referencia um atleta (categorias de simples) ou uma dupla (categorias de duplas), nunca os dois. Quem inscreve duplas informa `pairId` ou os dois atletas; neste caso a dupla é reaproveitada se já existir (mesmo tenant e disciplina, em qualquer ordem) ou criada. Dupla inativa recusa inscrição (`409 PAIR_INACTIVE`).
- Estados: `pending` (ao inscrever), `approved` (única que entra na chave) e `rejected` (exige motivo em `notes`, que nunca aparece nas rotas públicas). Transições: `pending → approved | rejected`, `approved → pending | rejected`, `rejected → pending`. Aprovar é idempotente.
- Elegibilidade na hora de inscrever (`apps/api/src/domain/eligibility.ts`): número de atletas coerente com a disciplina, regra de gênero, atleta ativo, atleta fora de outra inscrição ativa da categoria (sozinho ou em dupla: `409 ATHLETE_ALREADY_REGISTERED`) e vaga livre (`409 CATEGORY_FULL`). A checagem roda sob lock da linha da categoria, para que inscrições simultâneas não passem juntas pelo limite.
- Quem já está numa chave não pode ser recusado, movido de categoria nem removido (`409 REGISTRATION_IN_DRAW`): refaça a chave antes. Só se muda de categoria dentro do mesmo torneio e da mesma disciplina.
- Torneio encerrado ou cancelado recusa qualquer alteração (`409 TOURNAMENT_LOCKED`).
- A lista pública de uma categoria esconde recusadas e `notes`; a lista administrativa (`GET /registrations/tournament/:id`, exige modo admin) mostra tudo, paginada, com filtros `status` e `categoryId`.
- Regras de domínio em `apps/api/src/domain` (`registration-rules.ts`, `eligibility.ts`), schemas em `packages/validators`. O código lê atletas de uma inscrição por `selectRegistrations` (`apps/api/src/db/registrations.ts`), que resolve `athleteId`/`athlete2Id` pela dupla; não leia as colunas direto.

### Chaves

- Só eliminação simples está implementada. A chave tem tamanho da próxima potência de 2 acima do número de inscritos aprovados; vagas vazias viram byes.
- Modos de sorteio: aleatório e com cabeças de chave (cabeças 1 e 2 em extremos opostos, 3 e 4 sorteadas entre as metades, 5 a 8 entre os quartos).
- **Rodadas contam até a final:** a rodada de número mais alto é a primeira fase e a rodada 1 é a final. Cada partida aponta para a seguinte por `nextMatchId`; a vencedora da posição `p` ocupa o slot 1 (se `p` for ímpar) ou 2 (se par) da posição `ceil(p/2)` na rodada seguinte. O gerador fica em `apps/api/src/domain/bracket.ts` e é usado pela API e pelo seed.
- Bye é uma partida da primeira fase com um único inscrito e status `walkover`; o inscrito avança na hora.
- Chave publicada não pode ser ressorteada (`409 DRAW_PUBLISHED`). Ressortear limpa os resultados em cascata.

### Resultados

- Resultado é uma lista de sets. O vencedor é quem venceu mais sets, e avança automaticamente para a partida seguinte.
- Alterar o vencedor de uma partida já decidida desfaz em cascata as partidas seguintes que dependiam dele.
- No W.O., o diálogo de resultado grava 21-0 para quem avança. Na desistência (`retired`), grava as parciais com o vencedor fazendo 21. O vencedor é sempre lido dos sets salvos, nunca presumido pelo slot.
- Resultado de partida de torneio `completed` ou `cancelled` é recusado com `409 TOURNAMENT_LOCKED`; reabra o torneio para corrigir (o `reopen` zera `finalPlacement` e revoga os pontos).

### Agenda automática

`POST /tournaments/:id/schedule/auto` propõe ou grava quadra e horário (`scheduledAt`, `courtNumber`) das partidas do torneio, sem mudança de schema: quadras, início, duração e descanso são parâmetros da chamada. Como toda escrita, exige modo admin (inclusive a pré-visualização, que é um `POST`). A regra é pura e mora em `apps/api/src/domain/schedule.ts` (`planSchedule`); a rota (`routes/schedule.ts`) só carrega os dados e grava. O corpo é validado por `autoScheduleBodySchema` (`packages/validators/src/schedule.ts`).

Corpo:

| Campo | Regra |
|---|---|
| `courts` | inteiro de 1 a 32 |
| `startAt` | ISO 8601 com deslocamento (`2026-10-24T09:00:00-03:00` ou `Z`); o web envia o deslocamento local do navegador |
| `matchMinutes` | inteiro de 5 a 240 (duração de toda partida) |
| `restMinutes` | inteiro de 0 a 240 (descanso mínimo entre duas partidas do mesmo atleta e entre uma partida e as que a alimentam) |
| `reschedule` | boolean, padrão `false` |
| `dayStartsAt`, `dayEndsAt` | opcionais, "HH:mm" no fuso do deslocamento de `startAt`. Com qualquer um dos dois há janela diária: padrão de início é a hora de `startAt` e de fim a meia-noite. Partida que não cabe até o fim do dia vai para o início do dia seguinte. Fim depois do início e janela maior que `matchMinutes`, senão `400 VALIDATION_ERROR` (ou `422 INVALID_DAY_WINDOW` quando só um dos dois foi enviado) |
| `dryRun` | boolean, padrão `true` |

Resposta (a mesma com `dryRun` verdadeiro ou falso; só a segunda grava):

```json
{
  "dryRun": true, "applied": false,
  "params": { "courts": 2, "startAt": "2026-10-24T09:00:00-03:00", "matchMinutes": 40, "restMinutes": 15, "reschedule": false },
  "summary": { "planned": 12, "unscheduled": 0 },
  "assignments": [{
    "matchId": "…", "categoryId": "…", "categoryName": "Simples Masculino", "discipline": "MS", "drawId": "…",
    "round": 3, "roundLabel": "Quartas de final", "position": 1,
    "participant1": "Ana Souza", "participant2": "Bia Lima",
    "courtNumber": 1, "scheduledAt": "2026-10-24T12:00:00.000Z"
  }],
  "unscheduled": [{ "matchId": "…", "…": "…", "reason": "Depende de uma partida anterior que não pôde ser agendada." }],
  "warnings": ["A agenda ocupa 2 dias."]
}
```

Os nomes são só os públicos dos atletas (duplas como "A / B"); nenhum dado pessoal. `scheduledAt` sai em UTC.

Regras do algoritmo:

- Entram as partidas pendentes que não são bye. Bye é a regra de sempre: primeira fase com um único inscrito em `walkover` (primeira fase vazia também é ignorada). Em andamento e encerradas nunca são alteradas.
- Ordem: fase (a primeira fase antes, a final por último, contando por chave), depois chave e posição. Uma partida só começa depois que as duas partidas que a alimentam (`nextMatchId`) terminam, mais `restMinutes`, usando o horário já gravado ou o recém-planejado.
- Um atleta (os dois parceiros de uma dupla) nunca fica em duas partidas sobrepostas e tem pelo menos `restMinutes` entre elas, contando as partidas já agendadas ou encerradas de todas as categorias do torneio. Como o vencedor de uma partida futura ainda não existe, ela é tratada como se qualquer atleta que pode chegar a ela jogasse (decisão conservadora: garante a ausência de conflito, ao custo de mais espera nas fases finais).
- Cada partida vai para a quadra de menor número livre no primeiro horário possível. Partidas encerradas ou em andamento com horário e quadra, e as pendentes que já têm horário e quadra (com `reschedule: false`), ocupam atletas e quadras como obstáculos e entram em `warnings` se conflitarem entre si. Com `reschedule: true`, as pendentes são replanejadas do zero. Pendente com só horário ou só quadra é replanejada, com aviso.
- A duração das partidas já gravadas é `matchMinutes` (o schema não guarda a duração). O resultado é determinístico para a mesma entrada.
- O deslocamento de fuso do `startAt` vale para toda a agenda (sem horário de verão).
- `unscheduled` lista o que não coube, com o motivo em português (dependência sem horário, janela diária menor que a partida, nenhum horário livre).

Erros: `409 TOURNAMENT_LOCKED` com torneio encerrado ou cancelado (mesma regra do resultado de partida); `404` com torneio inexistente ou excluído; `422 NO_MATCHES` sem chaves geradas; `400 VALIDATION_ERROR` no corpo. Aplicar (`dryRun: false`) lê, planeja e grava numa transação só, com o torneio travado. Como as demais rotas de torneio, a busca é por id e não filtra por tenant (lacuna conhecida, fora do escopo desta entrega). No web, a aba Agenda tem o botão "Gerar agenda automática": pré-visualiza (`dryRun: true`) agrupando por dia e quadra e só então aplica.

### Pontos e ranking

- A colocação é derivada da chave: o vencedor da final é 1º e o perdedor 2º; quem perde na rodada `r` fica em `2^(r-1) + 1` (3º nas semifinais, 5º nas quartas, 9º nas oitavas). `finalize` devolve o pódio, e `award-points` e o recálculo do ranking usam a mesma regra. A regra vive em `domain/placements.ts` (`computePlacements`). `finalize` grava `finalPlacement` em todas as inscrições que têm colocação, na mesma transação que muda o status para `completed`; `reopen` zera `finalPlacement` de todas as inscrições do torneio (inclusive removidas), porque os resultados podem mudar. O perfil público do atleta lê essa coluna (pódios e selo de colocação).
- Há um único motor de ranking, `apps/api/src/services/ranking-engine.ts`, e toda pontuação sai de `point_rules` (uma regra por ranking, nível e, opcionalmente, disciplina: colocação → pontos base, multiplicador e bônus de participação). Distribuir pontos, reabrir um torneio e recalcular um ranking passam por ele.
- `POST /tournaments/:id/award-points` só vale quando todas as categorias têm chave e todas as partidas terminaram (`409 TOURNAMENT_NOT_FINISHED`, com a lista do que falta). Ele vincula o torneio aos rankings ativos do tenant que têm categoria na disciplina e regra para o nível, marca `pointsAwarded` (repetir responde `409 POINTS_ALREADY_AWARDED`) e recalcula esses rankings. Sem ranking para as disciplinas, `422 NO_RANKING`; sem regra para o nível em nenhum ranking, `422 NO_POINT_RULES`, e nada é gravado.
- `POST /tournaments/:id/reopen` desfaz os vínculos e recalcula todo ranking que contava o torneio (por vínculo ou `autoInclude`), então os pontos dos outros torneios permanecem.
- O recálculo do ranking resolve os pontos pela regra mais específica (nível + disciplina), depois a genérica (só nível). Sem regra para o nível, a colocação vale 0 pontos.
- `countBestResults` limita a soma aos melhores resultados; `minTournamentsRequired` exclui quem jogou menos torneios.

## Convenções

### TypeScript

- `strict: true` em todos os pacotes.
- Sem `any`: use tipos específicos ou `unknown`.
- `interface` para objetos públicos, `type` para composições.
- Valores `as const` no lugar de `enum` do TypeScript.
- Imports relativos com extensão `.js` na API (NodeNext).

### Web

- Páginas são Server Components por padrão. `'use client'` só com estado, eventos, efeitos ou TanStack Query.
- Páginas públicas são Server Components. O admin usa TanStack Query em tudo, via `apiFetch`; nunca `fetch` cru para a API.
- Formulários validam com os schemas de `packages/validators`.
- Reutilize `components/ui` e `components/shared`. Nunca crie uma segunda sidebar, shell ou layout administrativo: a área admin usa o layout de `app/admin`.
- Toda tela trata carregamento, erro, vazio e sucesso.
- Sem dados simulados: telas mostram apenas dados reais da API.

### API

- Todo input é validado com Zod antes da lógica de negócio.
- Regras puras ficam em `src/domain`, com testes; rotas só orquestram.
- Operações críticas com várias escritas usam transação.

### Banco de dados

- Mudanças de schema só por migration gerada: `db:generate` e depois `db:migrate`. `db:push` é proibido.
- `db:reset` apaga e recria o banco a partir das migrations. Ele recusa produção e hosts não locais.
- Índices em chaves estrangeiras e colunas de busca frequente; constraints de integridade (unique, FK, check).

### Textos

- Arquivos em UTF-8, com acentuação correta em português em todos os textos de interface e documentação.

### Git

- Conventional Commits.
- Branches `feat/...`, `fix/...`, `docs/...` ou `chore/...`. Nunca commitar direto na `main`: todo trabalho entra por PR.

## Critério de pronto

Uma entrega só está pronta quando:

- A rota está acessível pela navegação correta, sem rotas, layouts ou menus redundantes.
- Está alinhada ao schema e ao contrato real da API.
- Valida dados no cliente e no servidor.
- Trata carregamento, erro, vazio e sucesso.
- Passa `pnpm turbo run check-types lint test build`.
- Tem testes para a lógica de domínio nova.
- Teve os textos revisados quanto à acentuação.
- Atualizou esta especificação e o `PROGRESS.md` quando mudou comportamento ou contrato.

## Planejado

O que ainda não existe, em ordem aproximada. O detalhe está no [`PROGRESS.md`](../PROGRESS.md).

- **Autenticação:** Clerk, com organizações para o seletor de tenant e os papéis `federation_admin`, `tournament_organizer`, `referee`, `club_manager`, `athlete` e `public`, checados em middleware.
- **Formatos de chave:** eliminação dupla, round robin, grupos + eliminatória e sistema suíço.
- **Partidas:** auditoria de resultados (quem lançou e quando), resultados ao vivo por polling.
- **Ranking:** cache (Redis, TTL de 1 hora), critérios de desempate.
- **Portal público:** estatísticas e histórico de atletas, head-to-head.
- **Admin:** relatórios exportáveis, notificações, gestão de usuários e papéis.
- **Infraestrutura:** Vercel (web), Railway (API, PostgreSQL e Redis), Cloudinary ou Uploadthing (uploads), Resend (e-mails), Sentry (erros), rate limiting.
- **Qualidade:** testes E2E com Playwright, PWA, acessibilidade WCAG 2.1 AA.
