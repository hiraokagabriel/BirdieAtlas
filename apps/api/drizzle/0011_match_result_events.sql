CREATE TYPE "public"."result_source" AS ENUM('dialog', 'live');--> statement-breakpoint
CREATE TABLE "match_result_events" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"source" "result_source" NOT NULL,
	"court_number" integer,
	"previous_status" "match_status" NOT NULL,
	"previous_sets" jsonb NOT NULL,
	"next_status" "match_status" NOT NULL,
	"next_sets" jsonb NOT NULL,
	"reset_match_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "match_result_events_match_idx" ON "match_result_events" USING btree ("match_id","created_at");
