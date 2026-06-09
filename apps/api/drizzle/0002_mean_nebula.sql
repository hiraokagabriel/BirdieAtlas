CREATE TYPE "public"."discipline" AS ENUM('MS', 'WS', 'MD', 'WD', 'XD');--> statement-breakpoint
ALTER TABLE "rankings" ADD COLUMN "discipline" "discipline" NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_categories" ADD COLUMN "discipline" "discipline" NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_categories" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rankings" DROP COLUMN "category_type";--> statement-breakpoint
ALTER TABLE "tournament_categories" DROP COLUMN "category_type";--> statement-breakpoint
DROP TYPE "public"."category_type";