# Contrato de inscrições em torneios

## Objetivo

Padronizar o contrato utilizado pelo frontend e pela API para consulta, edição e aprovação de inscrições.

## Regras de domínio

- Uma inscrição deve referenciar exatamente um atleta ou uma dupla.
- `pending` representa uma inscrição aguardando revisão.
- `approved` representa uma inscrição validada e elegível para fechamento da categoria.
- `rejected` representa uma inscrição recusada e deve possuir um motivo em `notes`.
- A aprovação é idempotente e não pode duplicar pontos ou eventos.
- Inscrições de torneios publicados ou finalizados ficam bloqueadas para edição comum.
- Campos desconhecidos devem ser rejeitados pelos schemas de entrada.

## Consulta

`GET /registrations/tournament/:tournamentId`

Query params:

- `status`: `pending`, `approved` ou `rejected`.
- `page`: página iniciando em 1.
- `pageSize`: de 1 a 100, padrão 25.

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

O body deve conter ao menos um campo. Se `status` for `rejected`, `notes` deve conter o motivo da rejeição. O backend deve validar a elegibilidade antes de aceitar a troca de categoria ou aprovação.

## Aprovação

`POST /registrations/:registrationId/approve`

Body opcional:

```json
{
  "notes": "Documentação conferida"
}
```

A aprovação deve ser idempotente: aprovar uma inscrição já aprovada não pode duplicar eventos, pontos ou registros relacionados.

## Auditoria

Toda criação, atualização, aprovação ou rejeição deve produzir um evento com:

- ação;
- inscrição;
- usuário responsável;
- status anterior;
- status seguinte;
- motivo;
- data e hora.

## Erros

```json
{
  "error": "A inscrição não pode ser aprovada.",
  "code": "REGISTRATION_NOT_ELIGIBLE",
  "details": {}
}
```
