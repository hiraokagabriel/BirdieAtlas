import { athletes } from './schema.js'

/**
 * Colunas de atleta que podem sair em qualquer resposta, inclusive pública.
 * E-mail e data de nascimento são dados pessoais: só as rotas administrativas de atletas os devolvem.
 */
export const publicAthleteColumns = {
  id: athletes.id,
  name: athletes.name,
  gender: athletes.gender,
  nationality: athletes.nationality,
  photoUrl: athletes.photoUrl,
  active: athletes.active,
}
