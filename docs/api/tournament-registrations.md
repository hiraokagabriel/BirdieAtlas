# Contrato de inscrições em torneios

> Status: implementado. Schemas em `packages/validators/src/registration.ts`; regras em `apps/api/src/domain` (`registration-rules.ts`, `eligibility.ts`); rotas em `apps/api/src/routes/registrations.ts`. A especificação geral está em [`ESPECIFICACAO_COMPLETA.md`](../ESPECIFICACAO_COMPLETA.md).

## Modelo

Uma inscrição pertence a uma categoria e referencia exatamente um atleta (`athleteId`, categorias de simples) ou uma dupla (`pairId`, categorias de duplas). Na resposta, `athleteId` e `athlete2Id` são sempre os atletas da inscrição: em duplas, os da dupla.

Estados: `pending` (ao inscrever), `approved` (única que entra na chave) e `rejected` (exige motivo em `notes`).

| De | Para |
|---|---|
| `pending` | `approved`, `rejected` |
| `approved` | `pending`, `rejected` |
| `rejected` | `pending` |

Campos desconhecidos são rejeitados (`400 VALIDATION_ERROR`).

## Inscrever

`POST /tournaments/categories/:categoryId/register`

```json
{ "athleteId": "…", "seed": 2 }
```

Simples: só `athleteId`. Duplas: `pairId`, ou `athleteId` + `athlete2Id` (a dupla é reaproveitada ou criada). `seed` é opcional. Responde `201` com a inscrição `pending`.

| Status | Código | Quando |
|---|---|---|
| 404 | `CATEGORY_NOT_FOUND`, `TOURNAMENT_NOT_FOUND`, `PAIR_NOT_FOUND`, `ATHLETE_NOT_FOUND` | Recurso inexistente ou excluído |
| 409 | `TOURNAMENT_LOCKED` | Torneio encerrado ou cancelado |
| 422 | `WRONG_PARTICIPANT_COUNT` | Atletas demais ou de menos para a disciplina |
| 422 | `GENDER_INCOMPATIBLE`, `ATHLETE_INACTIVE`, `PAIR_DISCIPLINE_MISMATCH` | Regra de elegibilidade |
| 409 | `ATHLETE_ALREADY_REGISTERED` | Atleta já em outra inscrição ativa da categoria, sozinho ou em dupla |
| 409 | `CATEGORY_FULL` | Limite de vagas (`maxEntries`) atingido |
| 409 | `PAIR_INACTIVE` | A dupla existe, mas está inativa |

A verificação roda sob lock da linha da categoria: inscrições simultâneas não passam juntas pelo limite de vagas.

## Consultar

**Público:** `GET /tournaments/categories/:categoryId/registrations` devolve a lista completa (sem paginação) das inscrições `pending` e `approved`, com `athleteName`/`athlete2Name`. Nunca devolve `notes` nem inscrições recusadas.

**Admin:** `GET /registrations/tournament/:tournamentId` (exige modo admin) devolve `{ data, pagination }` com todas as inscrições, inclusive recusadas e com `notes`.

Query: `status` (`pending`, `approved`, `rejected`), `categoryId`, `page` (a partir de 1) e `pageSize` (1 a 100, padrão 25).

## Atualizar

`PATCH /registrations/:registrationId`

```json
{ "status": "rejected", "notes": "Documento inválido" }
```

Campos: `categoryId`, `status`, `notes`; ao menos um. `rejected` exige `notes`. `categoryId` só aceita categoria do mesmo torneio e da mesma disciplina.

| Status | Código | Quando |
|---|---|---|
| 404 | `REGISTRATION_NOT_FOUND` | Inscrição inexistente |
| 409 | `TOURNAMENT_LOCKED` | Torneio encerrado ou cancelado |
| 422 | `INVALID_REGISTRATION_TRANSITION` | Transição fora da tabela acima |
| 422 | `INVALID_REGISTRATION_CATEGORY` | Categoria de outro torneio ou disciplina |
| 409 | `REGISTRATION_IN_DRAW` | Recusar ou mover quem já está numa chave |

## Aprovar

`POST /registrations/:registrationId/approve`, body opcional `{ "notes": "…" }`. Idempotente: aprovar uma inscrição já aprovada devolve a inscrição como está. Os mesmos erros de `PATCH` valem.

## Remover

`DELETE /tournaments/registrations/:registrationId` faz soft delete (`204`). Recusa com `409 TOURNAMENT_LOCKED` ou `409 REGISTRATION_IN_DRAW`.

## Pendente

**Auditoria** (quem aprovou ou recusou, quando, e o motivo) depende de identidade de usuário e entra junto com o Clerk. Hoje só `notes` e `updatedAt` registram o que aconteceu.
