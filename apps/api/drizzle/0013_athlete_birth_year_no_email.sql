-- Minimização de dados (versão online): o atleta guarda só o ano de nascimento; e-mail e data completa saem.
DROP INDEX "athletes_email_unique";--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "birth_year" integer;--> statement-breakpoint
UPDATE "athletes" SET "birth_year" = EXTRACT(YEAR FROM "birth_date")::integer WHERE "birth_date" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "athletes" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "athletes" DROP COLUMN "birth_date";
