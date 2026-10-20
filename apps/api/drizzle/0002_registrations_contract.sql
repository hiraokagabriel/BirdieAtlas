ALTER TABLE "tournament_registrations" DROP CONSTRAINT "tournament_registrations_athlete2_id_athletes_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_category_athlete_unique" ON "tournament_registrations" USING btree ("category_id","athlete_id") WHERE deleted_at IS NULL AND status <> 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_category_pair_unique" ON "tournament_registrations" USING btree ("category_id","pair_id") WHERE deleted_at IS NULL AND status <> 'rejected';--> statement-breakpoint
CREATE INDEX "registrations_category_idx" ON "tournament_registrations" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "registrations_status_idx" ON "tournament_registrations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "tournament_registrations" DROP COLUMN "athlete2_id";--> statement-breakpoint
ALTER TABLE "tournament_registrations" DROP COLUMN "confirmed";--> statement-breakpoint
ALTER TABLE "tournament_registrations" DROP COLUMN "withdrew";--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "registrations_athlete_xor_pair" CHECK (("tournament_registrations"."athlete_id" IS NULL) <> ("tournament_registrations"."pair_id" IS NULL));