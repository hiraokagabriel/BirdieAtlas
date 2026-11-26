ALTER TABLE "athletes" ADD COLUMN "guest_tenant_id" text;--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_guest_tenant_id_tenants_id_fk" FOREIGN KEY ("guest_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Avulsos já existentes: a federação do torneio em que se inscreveram (simples ou dupla); o mais antigo decide.
UPDATE "athletes" AS a SET "guest_tenant_id" = sub."tenant_id"
FROM (
  SELECT DISTINCT ON (x."athlete_id") x."athlete_id", t."tenant_id"
  FROM (
    SELECT r."athlete_id", r."category_id", r."created_at" FROM "tournament_registrations" r WHERE r."athlete_id" IS NOT NULL
    UNION ALL
    SELECT p."athlete1_id", r."category_id", r."created_at" FROM "tournament_registrations" r JOIN "pairs" p ON p."id" = r."pair_id"
    UNION ALL
    SELECT p."athlete2_id", r."category_id", r."created_at" FROM "tournament_registrations" r JOIN "pairs" p ON p."id" = r."pair_id"
  ) x
  JOIN "tournament_categories" c ON c."id" = x."category_id"
  JOIN "tournaments" t ON t."id" = c."tournament_id"
  ORDER BY x."athlete_id", x."created_at"
) sub
WHERE a."id" = sub."athlete_id" AND a."guest" = true;
