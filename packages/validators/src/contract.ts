/**
 * Versão do contrato entre API e web. Suba este número no mesmo PR que muda o formato de uma resposta de modo
 * incompatível (campo novo obrigatório para o web, campo renomeado ou removido). A API envia o valor em
 * `x-api-contract`; o web compara com o dele e avisa quando os dois estão em versões diferentes (deploy fora de
 * ordem), em vez de falhar em silêncio.
 */
export const API_CONTRACT_VERSION = 2
export const API_CONTRACT_HEADER = 'x-api-contract'
