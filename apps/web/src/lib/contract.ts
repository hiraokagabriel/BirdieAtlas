import { API_CONTRACT_HEADER, API_CONTRACT_VERSION } from '@birdie-atlas/validators'

export const CONTRACT_MISMATCH_EVENT = 'ba:contract-mismatch'

/**
 * Compara o contrato da resposta com o do web. Diferente = deploy fora de ordem (API e site em versões distintas):
 * no navegador, dispara um evento que o aviso do layout escuta; no servidor, registra no log. Sem cabeçalho (API
 * antiga), não diz nada.
 */
export function checkContract(headers: Headers): void {
  const raw = headers.get(API_CONTRACT_HEADER)
  if (!raw || Number(raw) === API_CONTRACT_VERSION) return
  const detail = { api: raw, web: String(API_CONTRACT_VERSION) }
  if (typeof window === 'undefined') {
    console.warn(`[contrato] API em ${detail.api} e web em ${detail.web}: deploy fora de ordem?`)
    return
  }
  window.dispatchEvent(new CustomEvent(CONTRACT_MISMATCH_EVENT, { detail }))
}
