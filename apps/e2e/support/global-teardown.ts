import { API_URL } from './env.js'

// Os specs que desligam o modo admin restauram o estado sozinhos; isto é a rede de segurança.
export default async function globalTeardown(): Promise<void> {
  try {
    await fetch(`${API_URL}/dev/admin-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })
  } catch {
    // O servidor pode já ter sido encerrado: nada a restaurar.
  }
}
