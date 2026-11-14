import { athletes } from './schema.js'

/**
 * Colunas de atleta que podem sair em qualquer resposta, inclusive pública.
 * O ano de nascimento fica de fora: só as rotas administrativas de atletas o devolvem.
 */
export const publicAthleteColumns = {
  id: athletes.id,
  name: athletes.name,
  gender: athletes.gender,
  nationality: athletes.nationality,
  photoUrl: athletes.photoUrl,
  active: athletes.active,
}
