CREATE TABLE "match_live_states" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_live_states" ADD CONSTRAINT "match_live_states_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_live_states_match_unique" ON "match_live_states" USING btree ("match_id");