import { z } from "zod";

// Importação de um torneio inteiro a partir de planilha (XLSX ou CSV). O navegador lê o arquivo e envia as linhas
// como texto; a API normaliza os rótulos em português (disciplina, formato, sexo, situação...), valida tudo e só então grava.

export const IMPORT_MAX_CATEGORIES = 60;
export const IMPORT_MAX_ENTRIES = 3000;

const cell = z.string().max(300);

export const importTournamentSchema = z.object({
  /** `true` (padrão): só valida e devolve o relatório, sem gravar nada. */
  dryRun: z.boolean().default(true),
  tournament: z.object({
    name: cell,
    /** Em branco: gerado do nome (com sufixo se já existir). */
    slug: cell.optional(),
    /** "Oficial" ou "Amistoso" (padrão: oficial). */
    kind: cell.optional(),
    /** Local, Regional, Estadual, Nacional ou Internacional (padrão: estadual). */
    level: cell.optional(),
    /** AAAA-MM-DD ou DD/MM/AAAA. */
    startDate: cell,
    endDate: cell,
    city: cell.optional(),
    state: cell.optional(),
    location: cell.optional(),
  }),
  categories: z
    .array(
      z.object({
        /** Linha na planilha, para apontar erros. */
        row: z.number().int().min(1),
        name: cell,
        discipline: cell,
        drawType: cell.optional(),
        maxEntries: cell.optional(),
      }),
    )
    .max(IMPORT_MAX_CATEGORIES),
  entries: z
    .array(
      z.object({
        row: z.number().int().min(1),
        category: cell,
        athlete: cell,
        /** Duplas: o(a) parceiro(a). */
        partner: cell.optional(),
        gender: cell.optional(),
        partnerGender: cell.optional(),
        club: cell.optional(),
        partnerClub: cell.optional(),
        email: cell.optional(),
        partnerEmail: cell.optional(),
        seed: cell.optional(),
        /** Aprovada (padrão), Pendente ou Recusada. */
        status: cell.optional(),
      }),
    )
    .max(IMPORT_MAX_ENTRIES),
});

export type ImportTournamentInput = z.infer<typeof importTournamentSchema>;
export type ImportCategoryInput = ImportTournamentInput["categories"][number];
export type ImportEntryInput = ImportTournamentInput["entries"][number];

export interface ImportIssue {
  sheet: "Torneio" | "Categorias" | "Inscritos";
  /** Linha da planilha (0 = não se aplica a uma linha). */
  row: number;
  field: string;
  message: string;
}

export interface ImportReport {
  ok: boolean;
  dryRun: boolean;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  summary: {
    tournament: { name: string; slug: string; kind: "official" | "friendly" };
    categories: number;
    registrations: number;
    athletes: { existing: number; created: number };
    clubs: { existing: number; created: number };
    pairs: { existing: number; created: number };
  };
  /** Só depois de gravar. */
  tournamentId?: string;
}
