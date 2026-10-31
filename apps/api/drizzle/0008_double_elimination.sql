ALTER TYPE "public"."draw_type" ADD VALUE 'double_elimination';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "next_slot" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "loser_next_match_id" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "loser_next_slot" integer;