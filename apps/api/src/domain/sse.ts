// Formato Server-Sent Events (text/event-stream). Funções puras: quem escreve no socket é a rota.

export interface SseMessage {
  /** Nome do evento; sem ele o navegador entrega como `message`. */
  event?: string
  data: unknown
  id?: string | number
  /** Intervalo de reconexão sugerido ao navegador, em ms. */
  retry?: number
}

/** Cabeçalhos de um stream SSE: sem cache, sem transformação e sem buffer em proxies (nginx). */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

/** Quebras de linha em campos de uma linha só quebrariam o frame: viram espaço. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ')
}

/** Um frame SSE completo (termina com linha em branco). `data` vai como JSON numa única linha. */
export function formatSseMessage(message: SseMessage): string {
  let frame = ''
  if (message.retry !== undefined) frame += `retry: ${Math.max(0, Math.trunc(message.retry))}\n`
  if (message.id !== undefined) frame += `id: ${singleLine(String(message.id))}\n`
  if (message.event) frame += `event: ${singleLine(message.event)}\n`
  // JSON.stringify escapa quebras de linha: o dado ocupa sempre uma linha.
  frame += `data: ${JSON.stringify(message.data)}\n`
  return `${frame}\n`
}

/** Comentário SSE (linha iniciada por `:`): mantém a conexão aberta e é ignorado pelo cliente. */
export function formatSseComment(text: string): string {
  return `: ${singleLine(text)}\n\n`
}
