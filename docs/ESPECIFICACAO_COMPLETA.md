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
| Testes | Vitest (API, web e pacotes); Playwright (E2E, `apps/e2e`) |
| CI | GitHub Actions em todo push e PR para `main`: job `verify` (typecheck, lint, testes e build) e job `e2e` (Playwright) |

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
  e2e/                    testes ponta a ponta (Playwright): playwright.config.ts, support/ e tests/
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
| `/admin/live` | Placar ao vivo: tela do operador de quadra (celular e tablet) |
| `/admin/rankings`, `/admin/rankings/[rankingId]` | Rankings e regras de pontos |

Público, identificando por slug:

| Rota | Conteúdo |
|---|---|
| `/` | Landing |
| `/t/[slug]` | Torneio; em andamento, mostra "Ao vivo agora" e o placar corrente nos cartões da chave |
| `/t/[slug]/share-image` | PNG de compartilhamento do torneio (ver "Compartilhamento e exportações") |
| `/r/[tenantSlug]` | Rankings da federação |
| `/r/[tenantSlug]/share-image` | PNG do top 10 de um ranking |
| `/a/[athleteId]` | Perfil do atleta |
| `/a/[athleteId]/share-image` | PNG do cartão do atleta |
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
- Leituras que devolvem dados pessoais ou notas internas também exigem modo admin: `GET /athletes`, `GET /athletes/:id`, `GET /athletes/export.csv`, `GET /registrations/tournament/:tournamentId` e `GET /tournaments/:id/registrations/export.csv`. A lista fica em `ADMIN_ONLY_READS` (`admin-guard.ts`) e é coberta por `admin-guard.test.ts`.
- O Clerk é a última entrega e só chega com a build online; o uso previsto é local, em rede local. Enquanto ele não está integrado, o modo admin vem de `DEV_ADMIN_MODE=true` ou de `PATCH /dev/admin-mode`. Essa rota só existe fora de produção; em produção nenhuma escrita é possível.

### Dados pessoais

CPF, e-mail, telefone e data de nascimento são dados pessoais. Endpoints públicos nunca os devolvem: usam `publicAthleteColumns` (`apps/api/src/db/public-columns.ts`). Logs não registram dados pessoais. As imagens de compartilhamento e as exportações seguem a mesma regra: só nome, clube, colocação e pontos (ver "Compartilhamento e exportações").

### Busca pública de atletas

`GET /athletes/search?q=` é público (não exige modo admin) e alimenta a busca da home. `q` é aparado e tem de 2 a 80 caracteres; fora disso, `400 VALIDATION_ERROR`. `page` (padrão 1) e `pageSize` (padrão 10, máximo 25). A resposta é `{ data, pagination }`, ordenada por nome, com apenas campos públicos: `id`, `name`, `gender`, `nationality`, `photoUrl`, `active`, `clubName` e `clubSlug` (clube ativo no tenant padrão, `null` sem vínculo). Nunca devolve e-mail, CPF, telefone nem data de nascimento. Atletas excluídos (`deletedAt`) ficam de fora; inativos aparecem, como no perfil público.

A busca ignora caixa e acentos ("jose" encontra "José") com `lower` e `translate` do Postgres, sem extensão, para as letras acentuadas do português. Vários termos separados por espaço (até 5) precisam aparecer todos no nome, em qualquer ordem. `%`, `_` e `\` do usuário são escapados e valem como texto. A regra mora em `apps/api/src/domain/athlete-search.ts`. A rota é estática e o Fastify a prioriza sobre `/athletes/:id`.

### Tenant

O servidor aplica um tenant padrão em todas as consultas e escritas: `DEFAULT_TENANT_SLUG`, ou o único tenant cadastrado. `tenantId` enviado pelo cliente é ignorado. Atletas são globais (identidade entre federações); o vínculo com o tenant é a afiliação. O seletor de tenant chega com as organizações do Clerk.

### Endpoints

| Recurso | Endpoints |
|---|---|
| Atletas | `GET/POST /athletes`, `GET/PUT/DELETE /athletes/:id`, `GET /athletes/search` (público), `GET /athletes/:id/profile` (público), `GET /athletes/export.csv` (admin, CSV), `POST /athletes/import-csv` (por linha: `birthDate` no formato AAAA-MM-DD ou vazio; linha inválida entra em `errors` e as demais são criadas), `POST /import/athletes`, `GET /import/athletes/template-columns` |
| Afiliações | `GET/POST /athletes/:athleteId/affiliations`, `PATCH/DELETE /affiliations/:id` |
| Clubes | `GET/POST /clubs`, `GET/PUT/DELETE /clubs/:id`, `GET /clubs/by-slug/:slug`, `GET /clubs/:id/profile` |
| Duplas | `GET/POST /pairs`, `GET/PUT/DELETE /pairs/:id` (desativar é `PUT { active: false }`) |
| Torneios | `GET/POST /tournaments`, `GET/PUT/DELETE /tournaments/:id`, `GET /tournaments/by-slug/:slug`, `GET /tournaments/:id/public-summary`, `POST /tournaments/:id/transition`, `POST /tournaments/:id/finalize`, `POST /tournaments/:id/reopen` |
| Categorias | `GET/POST /tournaments/:id/categories` |
| Inscrições | `GET /tournaments/categories/:categoryId/registrations` (público; inclui `finalPlacement`, preenchida só com o torneio encerrado), `POST /tournaments/categories/:categoryId/register`, `GET /registrations/tournament/:tournamentId` (admin), `GET /tournaments/:id/registrations/export.csv` (admin, CSV), `GET /tournaments/:id/results/export.csv` e `GET /tournaments/:id/standings/export.csv` (públicos, CSV), `PATCH /registrations/:registrationId`, `POST /registrations/:registrationId/approve`, `DELETE /tournaments/registrations/:registrationId` |
| Chaves e partidas | `GET /tournaments/categories/:categoryId/draws`, `POST /draws/generate/:categoryId`, `POST /draws/:drawId/redraw`, `POST /draws/:drawId/publish`, `POST /draws/:drawId/unpublish`, `GET /draws/:drawId/matches`, `PATCH /draws/matches/:matchId/schedule`, `GET/POST /draws/matches/:matchId/result` |
| Agenda automática | `POST /tournaments/:id/schedule/auto` |
| Placar ao vivo | `GET /tournaments/:id/live` (SSE, público), `GET /tournaments/:id/live/matches` (público), `GET /tournaments/:id/live/queue` (público), `POST /draws/matches/:matchId/live/start`, `.../live/point`, `.../live/undo`, `.../live/finish`, `.../live/cancel` |
| Pontos e rankings | `POST /tournaments/:tournamentId/award-points`, `GET/POST /rankings`, `GET/PUT/DELETE /rankings/:rankingId`, `GET /rankings/:rankingId/entries`, `GET /rankings/:rankingId/entries/export.csv` (público, CSV), `POST /rankings/:rankingId/recalculate`, `GET /rankings/:rankingId/tournaments`, `POST/DELETE /rankings/:rankingId/tournaments/:tournamentId`, `GET/POST /rankings/:rankingId/point-rules`, `POST /rankings/:rankingId/point-rules/bulk`, `PUT/DELETE /rankings/:rankingId/point-rules/:ruleId` |
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
| `match_results` | Um registro por set; só resultado oficial |
| `match_live_states` | Placar provisório de uma partida em andamento: sequência de pontos (`points`, jsonb de 1 ou 2) e `version`; uma linha por partida (índice único em `match_id`) |
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
- A gravação do resultado é uma função só (`apps/api/src/services/match-result.ts`, `saveMatchResult`), usada pela rota `POST /draws/matches/:matchId/result` e pelo encerramento de uma partida ao vivo. Ela roda numa transação que trava a linha da partida (`FOR UPDATE`), grava os sets, faz o vencedor avançar, desfaz a cascata e apaga qualquer placar provisório da partida.

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

### Placar ao vivo

Uma partida `pending` com os dois lados definidos pode ser iniciada pelo operador de quadra; enquanto isso ela fica `in_progress` com um placar provisório. Ao encerrar, o placar vira o resultado oficial pela mesma lógica da rota de resultado (`saveMatchResult`: vencedor avança, cascata, validações).

**Modelo.** O placar provisório mora em `match_live_states`, tabela própria (migration `0004_match_live_states.sql`), e não em `match_results`: `computePlacements`, `finalize`, `award-points` e o motor de ranking leem `match_results` sem filtrar por status, então um set provisório ali seria lido como resultado. Com a tabela separada, o dado provisório nunca avança vencedor, nunca entra em colocação, pontos, ranking ou encerramento. Uma partida `in_progress` continua "pendente" para o ranking (`isPendingMatch`) e bloqueia `finalize` e `award-points`. A tabela guarda só a sequência de pontos (`points`: 1 ou 2, quem marcou); o placar (sets, set em disputa, vencedor) é sempre recalculado dela, e desfazer é remover o último ponto. A regra de placar é pura, em `apps/api/src/domain/live-score.ts`: set até 21 pontos com diferença de 2, limite de 30 (aos 29-29 o ponto seguinte decide), melhor de 3 sets. Quando a partida tem vencedor, novos pontos são recusados; ela só vira resultado ao encerrar. W.O. e desistência continuam pelo diálogo de resultado (que também substitui um placar provisório).

**Escritas** (exigem modo admin pelo guard global; `409 TOURNAMENT_LOCKED` com torneio encerrado ou cancelado; todas validadas com Zod):

| Endpoint | Corpo | Efeito |
|---|---|---|
| `POST /draws/matches/:matchId/live/start` | `{ courtNumber?: number \| null }` | `pending` → `in_progress`, placar 0-0. Sem `courtNumber` mantém a quadra da agenda. `422 MATCH_NOT_READY` sem os dois lados; `409 MATCH_NOT_STARTABLE` se não está pendente; `409 COURT_BUSY` se a quadra já tem partida em andamento no torneio |
| `POST .../live/point` | `{ side: 1 \| 2, version }` | Ponto para o lado. `409 LIVE_MATCH_DECIDED` se a partida já tem vencedor |
| `POST .../live/undo` | `{ version }` | Remove o último ponto. `409 NOTHING_TO_UNDO` sem pontos |
| `POST .../live/finish` | `{ version }` | Encerra: grava os sets como resultado (`completed`), avança o vencedor, apaga o provisório. `409 LIVE_MATCH_NOT_DECIDED` sem vencedor. Responde como a rota de resultado: `{ match, results }` |
| `POST .../live/cancel` | sem corpo | Descarta o provisório e volta a `pending` |

Comuns: `404 MATCH_NOT_FOUND`, `409 MATCH_NOT_LIVE` (ponto, desfazer, encerrar ou cancelar fora de `in_progress`).

**Concorrência.** Cada escrita roda numa transação que trava a linha da partida (`SELECT ... FOR UPDATE`); `start` também trava o torneio, para duas partidas não começarem juntas na mesma quadra. Ponto, desfazer e encerrar exigem `version`, a versão do placar que o operador viu na tela (sobe 1 a cada escrita). Se outro operador mexeu antes, a resposta é `409 LIVE_VERSION_CONFLICT` com `details: { expected, current }`, onde `current` é o placar atual: nada é gravado e o cliente passa a mostrar `current`. Assim, dois operadores na mesma partida nunca corrompem o placar nem contam o mesmo toque duas vezes.

**Leituras públicas** (só nomes de atletas, duplas como "A / B"; nunca e-mail, CPF, telefone nem nascimento):

- `GET /tournaments/:id/live/matches` devolve `LiveMatch[]`, por quadra, e é o fallback de polling.
- `GET /tournaments/:id/live/queue` devolve as partidas prontas para começar (`pending`, dois lados definidos), por quadra e horário; alimenta a tela do operador.

```json
{
  "matchId": "…", "tournamentId": "…", "categoryId": "…", "categoryName": "Simples Masculino", "discipline": "MS",
  "drawId": "…", "round": 3, "roundLabel": "Quartas de final", "position": 2,
  "courtNumber": 1, "scheduledAt": "2026-10-24T14:45:00.000Z", "status": "in_progress",
  "participant1": "Ana Souza", "participant2": "Bia Lima",
  "sets": [{ "score1": 21, "score2": 15 }],
  "currentSet": { "setNumber": 2, "score1": 10, "score2": 8 },
  "setsWon": { "side1": 1, "side2": 0 },
  "winner": null, "version": 33, "updatedAt": "2026-10-24T14:58:12.000Z"
}
```

`currentSet` é `null` quando há `winner` (falta só encerrar). `winner` é 1 ou 2.

**Stream SSE.** `GET /tournaments/:id/live` é público (leitura) e responde `text/event-stream` com `Cache-Control: no-cache, no-transform`, `Connection: keep-alive` e `X-Accel-Buffering: no`. Como a resposta é escrita à mão (`reply.hijack()`), os cabeçalhos de CORS que o `@fastify/cors` já pôs na resposta (`Access-Control-Allow-Origin` refletindo a origem, `Vary: Origin`) são copiados para o `writeHead`. Eventos, com `id` crescente por conexão e `data` em JSON de uma linha:

| `event` | `data` | Quando |
|---|---|---|
| `ready` | `{ tournamentId }` (traz `retry: 3000`) | ao conectar |
| `snapshot` | `{ matches: LiveMatch[] }` | logo após `ready`; a conexão assina o barramento antes de ler o snapshot e segura os eventos até enviá-lo |
| `match` | `{ match: LiveMatch }` | início, ponto, desfazer e mudança de quadra (upsert pela `matchId`; o cliente ignora versão mais antiga que a que já tem) |
| `match-ended` | `{ matchId, reason: "finished" \| "cancelled" }` | encerrada (por `finish` ou pela rota de resultado), cancelada ou desfeita em cascata; o cliente recarrega a chave |

Um comentário `: heartbeat` sai a cada 15 s. Ao desconectar (`close` da requisição) a assinatura e o timer são liberados; cliente lento (mais de 1 MB represado) é desconectado e recebe novo snapshot ao reconectar; ao fechar a API, todos os streams são encerrados. Torneio inexistente responde `404 TOURNAMENT_NOT_FOUND` em JSON antes do stream começar.

**Limitação: instância única.** O barramento (`apps/api/src/services/live-bus.ts`, `EventEmitter` por torneio) vive no processo. Com mais de uma instância da API, um evento só chega aos clientes conectados na instância que recebeu a escrita; o polling (`/live/matches`) enxerga tudo, porque lê do banco. Para escalar horizontalmente, troque o módulo por Postgres `LISTEN/NOTIFY` ou Redis pub/sub, mantendo a interface.

**Web.** O operador usa `/admin/live` (TanStack Query com polling de 3 s e atualização imediata pelas respostas): escolhe o torneio e a quadra, vê a partida em andamento ou a fila, inicia, marca pontos (botões grandes), desfaz e encerra com confirmação; erros da API aparecem na própria tela (inclui `TOURNAMENT_LOCKED` e `LIVE_VERSION_CONFLICT`). A página pública `/t/[slug]` mostra "Ao vivo agora" e o placar corrente nos cartões da chave quando o torneio está `in_progress`. Ela usa `EventSource` com reconexão por backoff exponencial com jitter (1 s a 30 s), mostra o estado da conexão (Conectando, Ao vivo, Reconectando, Atualizando a cada 5 s) e, depois de 4 falhas seguidas ou sem `EventSource`, cai para polling de `/live/matches` a cada 5 s, tentando voltar ao stream a cada 60 s. Uma região `aria-live="polite"` anuncia só início, fim de set, fim de jogo e partida encerrada; pontos soltos não são anunciados. A regra de eventos (reducer, backoff, anúncios) é pura, em `apps/web/src/lib/live.ts`. O layout de `app/admin` esconde a sidebar abaixo de `md` e mostra a mesma navegação (`ADMIN_NAV`) como faixa rolável.

### Pontos e ranking

- A colocação é derivada da chave: o vencedor da final é 1º e o perdedor 2º; quem perde na rodada `r` fica em `2^(r-1) + 1` (3º nas semifinais, 5º nas quartas, 9º nas oitavas). `finalize` devolve o pódio, e `award-points` e o recálculo do ranking usam a mesma regra. A regra vive em `domain/placements.ts` (`computePlacements`). `finalize` grava `finalPlacement` em todas as inscrições que têm colocação, na mesma transação que muda o status para `completed`; `reopen` zera `finalPlacement` de todas as inscrições do torneio (inclusive removidas), porque os resultados podem mudar. O perfil público do atleta lê essa coluna (pódios e selo de colocação).
- Há um único motor de ranking, `apps/api/src/services/ranking-engine.ts`, e toda pontuação sai de `point_rules` (uma regra por ranking, nível e, opcionalmente, disciplina: colocação → pontos base, multiplicador e bônus de participação). Distribuir pontos, reabrir um torneio e recalcular um ranking passam por ele.
- `POST /tournaments/:id/award-points` só vale quando todas as categorias têm chave e todas as partidas terminaram (`409 TOURNAMENT_NOT_FINISHED`, com a lista do que falta). Ele vincula o torneio aos rankings ativos do tenant que têm categoria na disciplina e regra para o nível, marca `pointsAwarded` (repetir responde `409 POINTS_ALREADY_AWARDED`) e recalcula esses rankings. Sem ranking para as disciplinas, `422 NO_RANKING`; sem regra para o nível em nenhum ranking, `422 NO_POINT_RULES`, e nada é gravado.
- `POST /tournaments/:id/reopen` desfaz os vínculos e recalcula todo ranking que contava o torneio (por vínculo ou `autoInclude`), então os pontos dos outros torneios permanecem.
- O recálculo do ranking resolve os pontos pela regra mais específica (nível + disciplina), depois a genérica (só nível). Sem regra para o nível, a colocação vale 0 pontos.
- `countBestResults` limita a soma aos melhores resultados; `minTournamentsRequired` exclui quem jogou menos torneios.

## Compartilhamento e exportações

Nada depende de serviço externo nem de biblioteca nova: imagens vêm de `next/og` (`ImageResponse`), o PDF vem do "Salvar como PDF" do navegador e o CSV é montado pela API.

### Imagens de compartilhamento

Rotas públicas (Route Handlers), que leem a API no servidor com os mesmos endpoints públicos das páginas e devolvem `image/png`:

| Rota | Imagem |
|---|---|
| `/t/[slug]/share-image` | 1200x630: nome, nível, datas, cidade e, com o torneio encerrado, pódio por categoria (campeão, vice e os terceiros). Antes do encerramento mostra categorias, atletas e partidas. `?format=portrait` gera a versão 1080x1350 ("story"), com os três lugares |
| `/a/[athleteId]/share-image` | 1200x630: nome, clube, títulos, pódios, torneios e melhor posição em ranking |
| `/r/[tenantSlug]/share-image` | 1200x630: top 10 do ranking. `?ranking=<id>` escolhe o ranking; sem ele, o primeiro da federação |

- `?download=1` devolve o PNG como anexo (`Content-Disposition`), com nome em slug.
- Rascunho de torneio é tratado como inexistente. Todo texto passa por `cleanText`/`truncateText` (`lib/share.ts`): sem caracteres de controle, de largura zero ou de direção, com limite de tamanho e reticências. O pódio mostra até 3 categorias (e "+ N categorias"); o resto vai só na página.
- A rota nunca devolve 500. Dado inexistente: imagem de fallback da marca com status `404`. API fora do ar: fallback com `200` e `Cache-Control: no-store`. Falha de renderização: tenta de novo sem a fonte da marca e depois com o fallback; só se nem o fallback renderizar responde `503`.
- Cache: `public, max-age=60, s-maxage=300, stale-while-revalidate=600` nas imagens completas.
- Identidade: gradiente verde, amarelo de destaque e medalhas ouro, prata e bronze, em hexadecimal (`lib/share-image/brand.ts`), porque o Satori não lê `oklch`. A fonte é a Barlow Condensed (500 e 700): o `ImageResponse` só aceita ttf/otf/woff e o `next/font` entrega woff2, então `lib/share-image/fonts.ts` baixa o ttf do Google Fonts na primeira imagem e o guarda em memória. Sem internet (ou em timeout de 4 s) a imagem sai com a fonte padrão do `ImageResponse`, sem erro, e uma nova tentativa só acontece depois de 5 minutos. Emoji não é usado nas imagens (o `ImageResponse` buscaria o emoji numa CDN).
- Cada página pública correspondente declara `openGraph` e `twitter` (`summary_large_image`) com a imagem, via `shareMetadata` (`lib/share-metadata.ts`). Os links são absolutos a partir de `metadataBase`, definido no layout raiz por `NEXT_PUBLIC_SITE_URL` (padrão `http://localhost:3000`; ver `apps/web/.env.example`). Em produção, configure o domínio real, senão o WhatsApp, o Instagram e o X recebem links `localhost`.
- Nas três páginas há "Compartilhar" (`ShareControl`): usa `navigator.share` quando existe; senão copia o link e confirma com toast e com uma região `aria-live`. "Baixar imagem" baixa o PNG (no torneio encerrado, também a versão "story"). A página de ranking usa o ranking selecionado.

### Impressão e PDF

Botão "Imprimir / Salvar PDF" (`PrintButton`) na chave do torneio público e no ranking público. Chama `window.print()`; não há biblioteca de PDF. As regras ficam em `apps/web/src/app/print.css` (importado por `globals.css`) e valem só em `@media print`, atuando em classes `print-*` e atributos `data-print-*`; a tela não muda.

- Somem no papel: cabeçalho, menu, seletor de tema, abas, seletores de categoria, estatísticas, botões e controles de compartilhar (variante `print:hidden` do Tailwind).
- Tema claro forçado: em `beforeprint` o botão tira a classe `dark` de `<html>` e a devolve em `afterprint` (vale também para Ctrl+P).
- Chave: página A4 paisagem (`@page bracket`), desenrolada (sem rolagem) e reduzida com `zoom` para caber (`computePrintScale`, `lib/print.ts`). Cartões de partida não são cortados entre páginas e os conectores saem (`print-color-adjust: exact`).
- Limite: a escala mínima é 0,4. Uma chave de 32 vagas já pede ~0,49; acima disso (64 vagas ou mais) a chave deixa de caber numa página sem ficar ilegível e continua na página seguinte, podendo cortar conectores na quebra. A largura sempre cabe. O `zoom` exige navegador recente (Chrome, Edge, Safari e Firefox 126 ou superior); sem ele a chave sai sem redução.
- Ranking: página A4 retrato (`@page ranking`); imprime a página atual da tabela (25 linhas), sem cortar uma linha ao meio.

### CSV

- `GET /tournaments/:id/registrations/export.csv` (admin): uma linha por inscrição, ordenadas por categoria. Colunas: `Categoria; Atleta; Parceiro(a); Clube; Cabeça de chave; Status` (`Pendente`, `Aprovada`, `Recusada`; recusadas incluídas). Dados pessoais: só nomes e o clube atual, nunca e-mail, data de nascimento nem `notes`. É leitura só de admin (`ADMIN_ONLY_READS`): sem modo admin, `403 ADMIN_MODE_DISABLED`.
- `GET /rankings/:rankingId/entries/export.csv` (público, como a lista de entradas): `Posição; Atleta; Parceiro(a); Pontos; Torneios`, ordenado pela posição. `404` para ranking inexistente.
- `GET /tournaments/:id/results/export.csv` (público): uma linha por partida de chave **publicada** (chave não publicada não sai), da primeira fase à final. Colunas: `Categoria; Fase; Partida; Lado 1; Lado 2; Placar; Vencedor; Situação; Quadra`. `Placar` lista os sets (`21-15 18-21`); `Vencedor` sai dos sets e fica vazio em W.O. e desistência sem sets.
- `GET /tournaments/:id/standings/export.csv` (público): `Categoria; Colocação; Atleta; Parceiro(a); Clube`, só com colocação final (torneio encerrado).
- `GET /athletes/export.csv` (admin, `ADMIN_ONLY_READS`): `Atleta; Gênero; Clube; Situação`. Sem e-mail nem data de nascimento. O clube é o atual no tenant padrão.
- Formato (`apps/api/src/domain/csv.ts`): UTF-8 com BOM, separador `;` (convenção do Excel em português do Brasil, onde a vírgula é separador decimal), quebra de linha CRLF e CRLF no fim. Campo com `;`, aspas ou quebra de linha vai entre aspas, com aspas dobradas. Texto que começa com `=`, `+`, `-`, `@`, TAB ou CR ganha um apóstrofo na frente (injeção de fórmula); números não são alterados.
- Cabeçalhos: `Content-Type: text/csv; charset=utf-8` e `Content-Disposition: attachment; filename="<slug>.csv"; filename*=UTF-8''<slug>.csv`. O nome é um slug ASCII (`slugifyFilename`), então não há injeção de cabeçalho. O CORS expõe `Content-Disposition` para o navegador ler o nome.
- Web: botão "Exportar CSV" na aba Inscrições do torneio e na página do ranking no admin (`ExportCsvButton`). Baixa por `fetch` e mostra o erro (`403`, rede) abaixo do botão.

Exemplo (`export.csv` de inscritos):

```
Categoria;Atleta;Parceiro(a);Clube;Cabeça de chave;Status
Simples Masculino;"'=HYPERLINK(""http://x"";""y"") Ana";;Clube Alfa;1;Aprovada
```

## Acessibilidade

Meta: WCAG 2.1 nível AA em todo o web, no tema claro e no escuro, no desktop e no celular. O que está garantido hoje é o que os testes abaixo cobrem; o resto (ver "Limites") depende de revisão manual.

### O que está garantido

- **Estrutura.** Idioma `pt-BR`; um `<h1>` por página e nenhum salto de nível (no admin o `<h1>` é o item da navegação e cada tela abre com um `<h2>`); landmarks `banner`, `navigation` (sempre com `aria-label` único), `main`; link "Pular para o conteúdo" como primeiro item do foco nos dois shells (`components/shared/skip-link.tsx`); `aria-current="page"` na navegação; título de aba descritivo e único por rota (`metadata` nas páginas de servidor, `useDocumentTitle` nas de cliente); página 404 própria, em português.
- **Teclado e foco.** Tudo que o mouse faz o teclado faz (linhas clicáveis da tabela de atletas têm um botão no nome, abas e escolhas exclusivas têm setas). Diálogos e painéis usam sempre o `Dialog`/`Sheet` do Radix (`components/ui`): foco preso, `Escape` fecha, o foco volta a quem abriu, o fundo fica inerte, nome e descrição obrigatórios. Foco visível em tudo: contorno sólido de 2px na cor `--ring` (3:1 no claro e no escuro), definido em `globals.css` e nos componentes de `components/ui`.
- **Formulários.** `Field` (`components/ui/field.tsx`) liga rótulo, dica e erro ao campo por `useId`: `<label for>`, `aria-describedby`, `aria-invalid`, `aria-required`, erro em `role="alert"`. Depois de um envio inválido o foco vai ao primeiro campo com erro (`lib/focus-invalid.ts`). Escolhas exclusivas (gênero, disciplina, categoria, tipo de resultado, modo de sorteio) usam `ChoiceGroup`: `<fieldset>` + `<input type="radio">` reais, então o estado é `checked`, não só a cor. Abas usam `Tabs` (Radix). Placeholder nunca é o único rótulo.
- **Tabelas e dados.** Tabelas reais com `<th scope>`, legenda (`<caption>` ou `aria-label` na região rolável) e região rolável focável; cabeçalhos ordenáveis com `aria-sort` (`components/shared/sort-header.tsx`); o ranking público e o do admin são `<table>`. A chave é uma região nomeada ("Chave de <categoria>") lida da primeira fase à final, com cada partida nomeada pelos dois lados. O gráfico do dashboard tem alternativa em tabela e o desenho fica fora da árvore de acessibilidade.
- **Cor e contraste.** Texto 4,5:1 (3:1 para texto grande) e componentes de interface e anéis de foco 3:1, nos dois temas. Status nunca só por cor: todo ponto colorido vem com texto ao lado. Tokens que mudaram em `globals.css`: `--destructive` claro de L 0,55 para 0,48 (botão destrutivo sobre o rodapé do diálogo de 3,7:1 para 4,6:1) e escuro de L 0,70 para 0,74 (de 3,9:1 para 4,65:1), com o fundo tingido do botão destrutivo em /10 no escuro também; `--field-border` novo para a borda de campos (3,5:1 sobre o fundo no claro, 4,5:1 no escuro, no lugar da `--input`, que dava 1,4:1 e continua só para preenchimentos); texto `/80` sobre `--primary` (hero e tela do operador) passou a `/90` (de 4,4:1 para 5,1:1). Anel de foco `--ring`: 3,6:1 no claro e 6,2:1 no escuro, sem mudança. A cor de marca do clube, que vem do cadastro, é misturada ao texto até dar 4,5:1 (`lib/club-color.ts`, com teste).
- **Movimento.** `prefers-reduced-motion: reduce` desliga toda animação e transição (regra única em `globals.css`); os pontos pulsantes e o `skeleton` também usam `motion-safe:`. A impressão e as imagens de compartilhamento não são afetadas.
- **Avisos.** Toasts: Radix, região "Notificações", botão de fechar com nome e sempre visível; erros ficam até serem dispensados, os demais somem em 10 s (pausam com mouse ou foco). Carregamento usa `role="status"`/`aria-busy`. O placar ao vivo anuncia só início, fim de set e fim de jogo; nenhuma região `aria-live="assertive"`.
- **Alvos.** Mínimo de 24x24 px em todo controle (exceto link dentro de texto corrido) e de 44 px na tela do operador de quadra.
- **Reflow.** Sem rolagem horizontal da página a partir de 320 px (400% de zoom em 1280 px) nem em 640 px (200%); tabelas e a chave rolam dentro de uma região focável.

### Como é testado

`pnpm e2e` roda três specs de acessibilidade em `apps/e2e/tests` (ver "Testes E2E"):

- `wcag.spec.ts`: axe-core (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) em todas as rotas públicas e do admin, com dados reais (torneio encerrado com chave e pódio, torneio com partida ao vivo, atleta com pódios, clube, ranking com pontos, listas, abas do torneio, tela do operador), nos temas claro e escuro e nos viewports 1280 e 390.
- `wcag-overlays.spec.ts`: o mesmo axe com cada overlay aberto (menu de tema, toasts, diálogo de resultado em todos os modos, agendamento e agenda automática, encerrar campeonato nos três estados, sheet e modais de atleta, clube, dupla, importação de CSV, formulários de inscrição e de ranking, select aberto), nas mesmas quatro combinações.
- `wcag-targeted.spec.ts`: o que o axe não vê: títulos únicos, ordem dos cabeçalhos, landmarks, rótulos de verdade (não placeholder), tabelas, skip link, indicador de foco com 2px e 3:1, setas nas abas, fluxos só com teclado (menu de tema, lançar resultado, cadastrar atleta), foco preso/devolvido e `Escape` em sete overlays, erros de formulário ligados ao campo, movimento reduzido, reflow em 320 e 640 px, alvos de 24 e 44 px, regiões `aria-live`.

A falha de uma violação do axe imprime regra, impacto, critério WCAG, seletor, HTML e link de ajuda. `support/axe.ts` tem a lista `ALLOWED_VIOLATIONS` para falsos positivos justificados: cada entrada é um nó (regra + trecho do seletor) com motivo e critério; nunca se desliga uma regra inteira, e `color-contrast` nunca é desligada. Hoje há três entradas, todas `aria-hidden-focus` no shell com um overlay modal do Radix aberto (o `Select` e o menu de tema, só nas auditorias "select aberto" e "menu de tema"): o Radix põe `aria-hidden` no shell e prende o foco no overlay, então nada do shell é alcançável, e um teste de foco comprova isso ("menu e lista abertos prendem o foco"). `WCAG_REPORT=<arquivo>` grava uma linha JSON por violação, para contar tudo de uma vez.

### Limites e o que falta

- O axe cobre cerca de um terço dos critérios; o resto é verificado pelo `wcag-targeted.spec.ts` só no que foi listado acima.
- **Passada manual com leitor de tela (NVDA, JAWS, VoiceOver, TalkBack) ainda não foi feita.** Os testes comprovam nomes, papéis, estados e ordem na árvore de acessibilidade, não como cada leitor os fala.
- Também faltam à mão: navegação só por teclado em um navegador real com extensões desligadas, zoom de 200% de texto (não só de página) em todas as telas, modo de alto contraste do Windows, `prefers-contrast`, legendas/alternativas para as imagens de compartilhamento (PNG gerados no servidor) e revisão do vocabulário em linguagem simples.
- O gráfico do dashboard (Recharts) é decorativo para tecnologia assistiva; a tabela oculta é a alternativa.
- Critérios do WCAG 2.2 que o time adotou como meta (alvo de 24 px) estão testados; os demais da 2.2 (por exemplo, autenticação acessível) não se aplicam enquanto não houver login.
- `wcag-print.spec.ts`: axe com a mídia `print` emulada na chave do torneio encerrado e no ranking (botões, abas e cabeçalho somem do papel) e checagem dos PNG de compartilhamento (status, tipo e dimensões). Os PNG não têm DOM; o axe não se aplica a eles.

## Testes E2E

Os testes de ponta a ponta ficam em `apps/e2e` (Playwright, só Chromium) e rodam com `pnpm e2e`. Eles não fazem parte de `pnpm turbo run check-types lint test build`: só o `check-types` e o `lint` do pacote entram nesse comando.

- **Isolamento.** O E2E não toca no ambiente de desenvolvimento. Usa o banco `birdieatlas_e2e` (o `support/global-setup.ts` recusa nomes sem "e2e" e o `db:reset` já recusa hosts não locais), a API na porta 3201 e o web na 3200. O banco é criado, migrado e populado a cada execução com os scripts da API (`db:create`, `db:reset`, `db:seed --profile small`). O web roda em build de produção (`next build` com `NEXT_DIST_DIR=.next-e2e` e `next start`), para não pisar no `.next` do desenvolvimento.
- **Dados.** O seed é aleatório (sufixos nos slugs) e os testes não dependem dele: cada spec cria os próprios dados pela API (`support/factories.ts`), com nomes e slugs únicos, e só usa a interface onde ela é o objeto do teste. Specs rodam em paralelo (2 workers); o spec `guard`, que liga e desliga o modo admin da API inteira, roda sozinho no projeto `guard`, depois do `main`.
- **Cobertura.** Portal público (home, busca, perfil, torneio encerrado com campeão, ranking e CSV, compartilhar, 404), ciclo de vida do torneio no admin (inscrições, sorteio, resultados pelo diálogo, encerrar, `TOURNAMENT_LOCKED`, reabrir), inscrições pela interface, cadastros (atletas, importação de CSV, clubes, duplas), rankings e regras de pontos no admin, relatórios CSV, agenda automática, placar ao vivo com SSE, tema, guard de modo admin, fumaça de acessibilidade e a auditoria WCAG (ver "Acessibilidade"). Comportamento ainda não implementado fica como `test.fixme` com o motivo.
- **CI.** O job `e2e` do GitHub Actions sobe um Postgres como serviço, instala o Chromium (`playwright install --with-deps`), roda `pnpm e2e` e, se falhar, envia o relatório HTML e os traces como artefato.

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
- Acessibilidade: campo com `Field`, escolha exclusiva com `ChoiceGroup`, abas com `Tabs`, diálogo e painel com `Dialog`/`Sheet`, ícone sem texto com `aria-label`, tabela com `<th scope>` e legenda. Tela nova mantém `wcag.spec.ts`, `wcag-overlays.spec.ts` e `wcag-targeted.spec.ts` verdes (ver "Acessibilidade").

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
- Branches `feat/...`, `fix/...`, `docs/...`, `chore/...`, `test/...` ou `refactor/...`. Fluxo completo em [`workflow.md`](../workflow.md). Nunca commitar direto na `main`: todo trabalho entra por PR.

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

- **Autenticação (por último):** o projeto roda localmente, em rede local, com o modo admin de desenvolvimento. O Clerk só entra junto com a build que roda online; tudo o que depende de identidade (auditoria de aprovação e de resultados, gestão de usuários e papéis, notificações) espera por ele. Clerk, com organizações para o seletor de tenant e os papéis `federation_admin`, `tournament_organizer`, `referee`, `club_manager`, `athlete` e `public`, checados em middleware.
- **Formatos de chave:** eliminação dupla, round robin, grupos + eliminatória e sistema suíço.
- **Partidas:** auditoria de resultados (quem lançou e quando); barramento do placar ao vivo entre instâncias (hoje em memória).
- **Ranking:** cache (Redis, TTL de 1 hora), critérios de desempate.
- **Portal público:** estatísticas e histórico de atletas, head-to-head.
- **Admin:** relatórios exportáveis além dos CSVs atuais (inscritos, ranking, resultados, classificação, atletas), notificações (dependem de provedor de e-mail/WhatsApp e de login), gestão de usuários e papéis.
- **Infraestrutura:** Vercel (web), Railway (API, PostgreSQL e Redis), Cloudinary ou Uploadthing (uploads), Resend (e-mails), Sentry (erros), rate limiting.
- **Qualidade:** PWA, passada manual de acessibilidade com leitores de tela (a automatizada já cobre WCAG 2.1 AA).
