export type PointRuleRow = {
  id: string;
  tournamentLevel: string;
  discipline: string | null;
  multiplier: number;
  participationBonus: number;
  entries: unknown;
};

export type PointEntry = { placement: number; basePoints: number };

/**
 * Normaliza o campo `entries` vindo do banco.
 * O Drizzle/pg pode retornar colunas jsonb como string JSON ou como objeto JS.
 */
export function parseEntries(raw: unknown): PointEntry[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is PointEntry => {
    if (typeof e !== "object" || e === null) return false;
    const entry = e as Record<string, unknown>;
    return typeof entry["placement"] === "number" && typeof entry["basePoints"] === "number";
  });
}

/**
 * Regra que vale para um nível e disciplina: a específica (nível + disciplina)
 * ou, na falta dela, a genérica (só nível). Sem nenhuma das duas, não há regra.
 */
export function findRule(rules: readonly PointRuleRow[], tournamentLevel: string, discipline: string): PointRuleRow | undefined {
  return (
    rules.find((r) => r.tournamentLevel === tournamentLevel && r.discipline === discipline) ??
    rules.find((r) => r.tournamentLevel === tournamentLevel && r.discipline === null)
  );
}

/** Pontos de uma colocação: (base da colocação + bônus de participação) × multiplicador. 0 quando não há regra. */
export function resolvePoints(
  rules: readonly PointRuleRow[],
  tournamentLevel: string,
  discipline: string,
  placement: number,
): number {
  const rule = findRule(rules, tournamentLevel, discipline);
  if (!rule) return 0;
  const entry = parseEntries(rule.entries).find((e) => e.placement === placement);
  return Math.round(((entry?.basePoints ?? 0) + rule.participationBonus) * rule.multiplier);
}
