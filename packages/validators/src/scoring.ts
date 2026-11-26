import { z } from "zod";

/**
 * Sistema de pontuação de uma categoria: até quantos pontos vai o set, o teto (no teto, o ponto seguinte decide)
 * e quantos sets vencem a partida. Fonte única da regra para o placar ao vivo (API) e o diálogo de resultado (web).
 * Com `setPointCap === pointsPerSet` não há vantagem de 2: quem chega aos pontos vence o set.
 */
export interface ScoringRule {
  pointsPerSet: number;
  setPointCap: number;
  setsToWin: number;
}

export const MIN_LEAD = 2;

/** Regra tradicional (BWF até 2026): 21 pontos, teto 30, melhor de 3. Padrão das categorias existentes. */
export const DEFAULT_SCORING: ScoringRule = { pointsPerSet: 21, setPointCap: 30, setsToWin: 2 };

export const SCORING_PRESETS = [
  { id: "21x3", label: "21 pontos, melhor de 3 (teto 30)", rule: DEFAULT_SCORING },
  { id: "15x3", label: "15 pontos, melhor de 3 (teto 21)", rule: { pointsPerSet: 15, setPointCap: 21, setsToWin: 2 } },
  { id: "11x5", label: "11 pontos, melhor de 5 (teto 15)", rule: { pointsPerSet: 11, setPointCap: 15, setsToWin: 3 } },
] as const satisfies readonly { id: string; label: string; rule: ScoringRule }[];

export const scoringRuleSchema = z
  .object({
    pointsPerSet: z.number().int().min(5).max(30),
    setPointCap: z.number().int().min(5).max(50),
    setsToWin: z.number().int().min(1).max(3),
  })
  .refine((r) => r.setPointCap >= r.pointsPerSet, {
    message: "O teto precisa ser igual ou maior que os pontos do set.",
    path: ["setPointCap"],
  });

/** "15 pontos, melhor de 3 (teto 21)"; sem vantagem de 2: "11 pontos, melhor de 3". Set único: "set único". */
export function scoringLabel(rule: ScoringRule): string {
  const sets = rule.setsToWin === 1 ? "set único" : `melhor de ${rule.setsToWin * 2 - 1}`;
  const cap = rule.setPointCap > rule.pointsPerSet ? ` (teto ${rule.setPointCap})` : "";
  return `${rule.pointsPerSet} pontos, ${sets}${cap}`;
}

/** Como um set termina nesta regra, para mensagens ("o set acaba em 15 com 2 de vantagem, ou em 21"). */
export function setEndingRule(rule: ScoringRule): string {
  if (rule.setPointCap === rule.pointsPerSet) return `o set acaba em ${rule.pointsPerSet} pontos`;
  return `o set acaba em ${rule.pointsPerSet} com 2 de vantagem, ou em ${rule.setPointCap}`;
}

/** Número máximo de sets de uma partida. */
export const maxSets = (rule: ScoringRule) => rule.setsToWin * 2 - 1;

/** Quem venceu o set com este placar, ou `null` se ainda está aberto (contagem ponto a ponto). */
export function setWinner(score1: number, score2: number, rule: ScoringRule = DEFAULT_SCORING): 1 | 2 | null {
  if (score1 >= rule.setPointCap) return 1;
  if (score2 >= rule.setPointCap) return 2;
  if (score1 >= rule.pointsPerSet && score1 - score2 >= MIN_LEAD) return 1;
  if (score2 >= rule.pointsPerSet && score2 - score1 >= MIN_LEAD) return 2;
  return null;
}

/** O placar final do set é possível nesta regra? (Ex.: 21-19 não fecha set de 21; 22-20 fecha.) */
export function isFinishedSet(score1: number, score2: number, rule: ScoringRule = DEFAULT_SCORING): boolean {
  if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0 || score1 === score2) return false;
  const w = Math.max(score1, score2);
  const l = Math.min(score1, score2);
  if (w < rule.pointsPerSet || w > rule.setPointCap) return false;
  // Sem vantagem de 2 (teto = pontos do set): quem chega primeiro vence, qualquer placar do outro.
  if (rule.setPointCap === rule.pointsPerSet) return true;
  // No teto, o set vinha de um placar aberto: o perdedor tinha teto - 2 ou teto - 1 (ex.: 30-28, 30-29).
  if (w === rule.setPointCap) return l >= rule.setPointCap - MIN_LEAD;
  if (w === rule.pointsPerSet) return w - l >= MIN_LEAD;
  return w - l === MIN_LEAD;
}

/**
 * Confere os sets de um resultado normal (`completed`): cada set fechado pela regra, sem set depois da partida
 * decidida e com um vencedor. Devolve a mensagem de erro em português ou `null`.
 */
export function validateSets(sets: readonly { score1: number; score2: number }[], rule: ScoringRule = DEFAULT_SCORING): string | null {
  let wins1 = 0;
  let wins2 = 0;
  for (const [i, s] of sets.entries()) {
    if (wins1 >= rule.setsToWin || wins2 >= rule.setsToWin) {
      return `O ${i + 1}º set não é necessário: a partida já foi decidida.`;
    }
    if (!isFinishedSet(s.score1, s.score2, rule)) {
      return `O ${i + 1}º set (${s.score1}-${s.score2}) não é um placar final: ${setEndingRule(rule)}.`;
    }
    if (s.score1 > s.score2) wins1++;
    else wins2++;
  }
  if (wins1 < rule.setsToWin && wins2 < rule.setsToWin) {
    return `Faltam sets: vence quem ganhar ${rule.setsToWin} ${rule.setsToWin === 1 ? "set" : "sets"}.`;
  }
  return null;
}

/**
 * Configuração padrão do sorteio guardada na categoria (`tournament_categories.draw_config`). Cada campo só vale
 * no formato dele; o sorteio usa estes valores quando o corpo não traz os seus. Limites finos (grupos que cabem
 * nos inscritos etc.) são conferidos no sorteio, quando o número de inscritos é conhecido.
 */
export const categoryDrawConfigSchema = z
  .object({
    groupCount: z.number().int().min(1).max(26).optional(),
    advancePerGroup: z.number().int().min(1).max(16).optional(),
    swissRounds: z.number().int().min(1).max(20).optional(),
    doubleEliminationReset: z.boolean().optional(),
  })
  .strict();
export type CategoryDrawConfig = z.infer<typeof categoryDrawConfigSchema>;
