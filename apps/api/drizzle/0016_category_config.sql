ALTER TABLE "tournament_categories" ADD COLUMN "points_per_set" integer DEFAULT 21 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_categories" ADD COLUMN "set_point_cap" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_categories" ADD COLUMN "sets_to_win" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_categories" ADD COLUMN "draw_config" jsonb;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "registration_deadline" date;