CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "tournament_registrations" ALTER COLUMN "athlete_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "pair_id" text;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "status" "registration_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Backfill. Dados inconsistentes (simples com parceiro, dupla sem parceiro) abortam a migração em vez de serem adivinhados.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tournament_registrations r
    JOIN tournament_categories c ON c.id = r.category_id
    WHERE (c.discipline IN ('MD', 'WD', 'XD')) <> (r.athlete2_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Migração abortada: há inscrições cujo número de atletas não bate com a disciplina da categoria. Corrija antes de migrar.';
  END IF;
END $$;--> statement-breakpoint
UPDATE tournament_registrations SET status = (CASE WHEN withdrew THEN 'rejected' WHEN confirmed THEN 'approved' ELSE 'pending' END)::registration_status;--> statement-breakpoint
UPDATE tournament_registrations SET notes = 'Desistência registrada antes da migração.' WHERE withdrew;--> statement-breakpoint
-- Uma dupla por par de atletas, tenant e disciplina (a ordem original do primeiro registro é preservada).
INSERT INTO pairs (id, tenant_id, athlete1_id, athlete2_id, discipline, active, created_at, updated_at)
SELECT gen_random_uuid()::text, d.tenant_id, d.a1, d.a2, d.discipline, true, now(), now()
FROM (
  SELECT DISTINCT ON (t.tenant_id, c.discipline, LEAST(r.athlete_id, r.athlete2_id), GREATEST(r.athlete_id, r.athlete2_id))
         t.tenant_id, c.discipline, r.athlete_id AS a1, r.athlete2_id AS a2
  FROM tournament_registrations r
  JOIN tournament_categories c ON c.id = r.category_id
  JOIN tournaments t ON t.id = c.tournament_id
  WHERE r.athlete2_id IS NOT NULL
  ORDER BY t.tenant_id, c.discipline, LEAST(r.athlete_id, r.athlete2_id), GREATEST(r.athlete_id, r.athlete2_id), r.created_at, r.id
) d
WHERE NOT EXISTS (
  SELECT 1 FROM pairs p
  WHERE p.tenant_id = d.tenant_id AND p.discipline = d.discipline AND p.deleted_at IS NULL
    AND LEAST(p.athlete1_id, p.athlete2_id) = LEAST(d.a1, d.a2)
    AND GREATEST(p.athlete1_id, p.athlete2_id) = GREATEST(d.a1, d.a2)
);--> statement-breakpoint
UPDATE tournament_registrations r
SET pair_id = (
  SELECT p.id FROM pairs p
  JOIN tournament_categories c ON c.id = r.category_id
  JOIN tournaments t ON t.id = c.tournament_id
  WHERE p.tenant_id = t.tenant_id AND p.discipline = c.discipline AND p.deleted_at IS NULL
    AND LEAST(p.athlete1_id, p.athlete2_id) = LEAST(r.athlete_id, r.athlete2_id)
    AND GREATEST(p.athlete1_id, p.athlete2_id) = GREATEST(r.athlete_id, r.athlete2_id)
  ORDER BY p.active DESC, p.created_at, p.id
  LIMIT 1
)
WHERE r.athlete2_id IS NOT NULL;--> statement-breakpoint
UPDATE tournament_registrations SET athlete_id = NULL WHERE pair_id IS NOT NULL;
