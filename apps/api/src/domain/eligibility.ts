export type Gender = "M" | "F";

export const DOUBLES_DISCIPLINES = ["MD", "WD", "XD"] as const;

export function isDoublesDiscipline(discipline: string): boolean {
  return (DOUBLES_DISCIPLINES as readonly string[]).includes(discipline);
}

/** MS/MD só masculino, WS/WD só feminino, XD exige um de cada. */
export function isGenderCompatible(discipline: string, gender1: Gender, gender2?: Gender): boolean {
  if (discipline === "MS" || discipline === "MD") return gender1 === "M" && (gender2 === undefined || gender2 === "M");
  if (discipline === "WS" || discipline === "WD") return gender1 === "F" && (gender2 === undefined || gender2 === "F");
  if (discipline === "XD") {
    if (!gender2) return false;
    return (gender1 === "M" && gender2 === "F") || (gender1 === "F" && gender2 === "M");
  }
  return true;
}

/** Ordem canônica dos dois atletas de uma dupla, para comparar duplas sem depender de quem veio primeiro. */
export function normalizePair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

export interface RegistrationEligibilityInput {
  discipline: string;
  /** Um atleta em singles, dois em duplas. */
  athletes: readonly { id: string; gender: Gender; active: boolean }[];
  /** Atletas que já têm inscrição ativa (pendente ou aprovada) na categoria, sozinhos ou em dupla. */
  takenAthleteIds: ReadonlySet<string>;
  maxEntries: number | null;
  /** Inscrições ativas (pendentes ou aprovadas) já na categoria. */
  currentEntries: number;
}

export interface EligibilityError {
  code: "WRONG_PARTICIPANT_COUNT" | "GENDER_INCOMPATIBLE" | "ATHLETE_INACTIVE" | "ATHLETE_ALREADY_REGISTERED" | "CATEGORY_FULL";
  message: string;
}

/** Elegibilidade de uma nova inscrição. Devolve o primeiro problema encontrado, ou `null` se estiver tudo certo. */
export function checkRegistrationEligibility(input: RegistrationEligibilityInput): EligibilityError | null {
  const { discipline, athletes, takenAthleteIds, maxEntries, currentEntries } = input;

  const expected = isDoublesDiscipline(discipline) ? 2 : 1;
  if (athletes.length !== expected) {
    return {
      code: "WRONG_PARTICIPANT_COUNT",
      message: expected === 2 ? "Esta categoria é de duplas: informe os dois atletas." : "Esta categoria é de simples: informe apenas um atleta.",
    };
  }

  if (!isGenderCompatible(discipline, athletes[0]!.gender, athletes[1]?.gender)) {
    return { code: "GENDER_INCOMPATIBLE", message: `Os atletas não atendem à regra de gênero da disciplina ${discipline}.` };
  }

  if (athletes.some((athlete) => !athlete.active)) {
    return { code: "ATHLETE_INACTIVE", message: "Atleta inativo não pode ser inscrito." };
  }

  if (athletes.some((athlete) => takenAthleteIds.has(athlete.id))) {
    return { code: "ATHLETE_ALREADY_REGISTERED", message: "Atleta já inscrito nesta categoria." };
  }

  if (maxEntries !== null && currentEntries >= maxEntries) {
    return { code: "CATEGORY_FULL", message: `A categoria atingiu o limite de ${maxEntries} inscrições.` };
  }

  return null;
}
