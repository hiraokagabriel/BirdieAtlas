import { EventEmitter } from 'node:events'

// Barramento pub/sub em memória do placar ao vivo, por torneio. As rotas de escrita publicam
// depois de gravar; cada conexão SSE assina o torneio que está assistindo.
//
// LIMITAÇÃO: o barramento vive no processo. Com mais de uma instância da API, um evento só chega
// aos clientes conectados na instância que recebeu a escrita. Para escalar horizontalmente,
// troque este módulo por Postgres LISTEN/NOTIFY ou Redis pub/sub mantendo a mesma interface.

export type LiveEvent<TMatch> =
  | { type: 'match'; match: TMatch }
  | { type: 'match-ended'; matchId: string; reason: 'finished' | 'cancelled' }

export type LiveListener<TMatch> = (event: LiveEvent<TMatch>) => void

export class LiveBus<TMatch> {
  private readonly emitter = new EventEmitter()

  constructor() {
    // Uma assinatura por conexão SSE: o limite padrão (10) geraria aviso falso.
    this.emitter.setMaxListeners(0)
  }

  /** Assina os eventos de um torneio; devolve a função que cancela a assinatura. */
  subscribe(tournamentId: string, listener: LiveListener<TMatch>): () => void {
    this.emitter.on(tournamentId, listener)
    return () => {
      this.emitter.off(tournamentId, listener)
    }
  }

  publish(tournamentId: string, event: LiveEvent<TMatch>): void {
    // Um ouvinte com defeito não pode derrubar a escrita que publicou nem os demais ouvintes.
    for (const listener of this.emitter.listeners(tournamentId) as LiveListener<TMatch>[]) {
      try {
        listener(event)
      } catch {
        // Ignorado de propósito: a conexão com defeito se encerra sozinha no evento 'close'.
      }
    }
  }

  listenerCount(tournamentId: string): number {
    return this.emitter.listenerCount(tournamentId)
  }
}
