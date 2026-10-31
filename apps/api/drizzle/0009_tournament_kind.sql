CREATE TYPE "public"."tournament_kind" AS ENUM('official', 'friendly');--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "kind" "tournament_kind" DEFAULT 'official' NOT NULL;