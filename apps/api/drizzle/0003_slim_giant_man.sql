CREATE TABLE "ranking_tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"ranking_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "primary_color" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "secondary_color" text;--> statement-breakpoint
ALTER TABLE "rankings" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "rankings" ADD COLUMN "auto_include" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "points_awarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ranking_tournaments" ADD CONSTRAINT "ranking_tournaments_ranking_id_rankings_id_fk" FOREIGN KEY ("ranking_id") REFERENCES "public"."rankings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_tournaments" ADD CONSTRAINT "ranking_tournaments_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;