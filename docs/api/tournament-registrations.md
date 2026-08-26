# Contrato de inscrições em torneios

## Objetivo

Padronizar o contrato utilizado pelo frontend e pela API para consulta, edição e aprovação de inscrições.

## Consulta

`GET /registrations/tournament/:tournamentId`

Query params:

- `status`: `pending`, `approved` ou `rejected`.
- `page`: página iniciando em 1.
- `pageSize`: de 1 a 100, padrão 25.

A rota valida todos os parâmetros com Zod e retorna:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

A leitura inicial não realiza mutações. A fonte temporária será substituída por Drizzle assim que os nomes definitivos das tabelas forem confirmados no schema central.

## Status

- `pending`: inscrição recebida e aguardando revisão.
- `approved`: inscrição validada e elegível para fechamento da categoria.
- `rejected`: inscrição recusada, sempre com motivo registrado em `notes`.

As transições críticas devem gerar evento de auditoria. A API deve impedir alterações em inscrições de torneios publicados ou finalizados, exceto por fluxo administrativo explícito.

## Atualização

`PATCH /registrations/:registrationId`

Body:

```json
{
  "categoryId": "category-id",
  "status": "approved",
  "notes": "Pagamento conferido"
}
```

O body deve conter ao menos um campo. O backend deve validar a elegibilidade antes de aceitar a troca de categoria ou aprovação.

## Aprovação

`POST /registrations/:registrationId/approve`

A aprovação deve ser idempotente: aprovar uma inscrição já aprovada não pode duplicar eventos, pontos ou registros relacionados.

## Erros

```json
{
  "error": "A inscrição não pode ser aprovada.",
  "code": "REGISTRATION_NOT_ELIGIBLE",
  "details": {}
}
```
