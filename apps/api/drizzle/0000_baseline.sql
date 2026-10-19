CREATE TYPE "public"."discipline" AS ENUM('MS', 'WS', 'MD', 'WD', 'XD');--> statement-breakpoint
CREATE TYPE "public"."draw_type" AS ENUM('single_elimination', 'round_robin', 'group_then_elimination');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'in_progress', 'completed', 'walkover', 'retired');--> statement-breakpoint
CREATE TYPE "public"."ranking_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tournament_level" AS ENUM('local', 'regional', 'state', 'national', 'international');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "athlete_affiliations" (
	"id" text PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"club_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athletes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"gender" "gender" NOT NULL,
	"birth_date" date,
	"nationality" text DEFAULT 'BR' NOT NULL,
	"photo_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tenant_id" text NOT NULL,
	"city" text,
	"state" text,
	"logo_url" text,
	"cover_url" text,
	"primary_color" text,
	"secondary_color" text,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draws" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"draw_mode" text DEFAULT 'random' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"score1" integer NOT NULL,
	"score2" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"draw_id" text NOT NULL,
	"round" integer NOT NULL,
	"position" integer NOT NULL,
	"registration1_id" text,
	"registration2_id" text,
	"next_match_id" text,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp,
	"court_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"athlete1_id" text NOT NULL,
	"athlete2_id" text NOT NULL,
	"discipline" "discipline" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"ranking_id" text NOT NULL,
	"tournament_level" "tournament_level" NOT NULL,
	"discipline" "discipline",
	"category" text,
	"multiplier" real DEFAULT 1 NOT NULL,
	"participation_bonus" real DEFAULT 0 NOT NULL,
	"entries" jsonb DEFAULT '[]' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"tournament_level" text NOT NULL,
	"placement" integer NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"ranking_id" text NOT NULL,
	"athlete_id" text NOT NULL,
	"athlete2_id" text,
	"position" integer NOT NULL,
	"previous_position" integer,
	"total_points" real DEFAULT 0 NOT NULL,
	"tournaments_count" integer DEFAULT 0 NOT NULL,
	"results_detail" jsonb DEFAULT '[]' NOT NULL,
	"manual_adjustment" real DEFAULT 0 NOT NULL,
	"override_reason" text,
	"override_by_user_id" text,
	"override_at" timestamp,
	"calculated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"ranking_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"level_override" "tournament_level",
	"tournament_multiplier" real DEFAULT 1 NOT NULL,
	"is_scoring" boolean DEFAULT true NOT NULL,
	"notes" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"discipline" "discipline" NOT NULL,
	"year" integer NOT NULL,
	"status" "ranking_status" DEFAULT 'active' NOT NULL,
	"count_best_results" integer,
	"min_tournaments_required" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"auto_include" boolean DEFAULT false NOT NULL,
	"last_calculated_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country" text DEFAULT 'BR' NOT NULL,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tournament_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"discipline" "discipline" NOT NULL,
	"name" text NOT NULL,
	"draw_type" "draw_type" DEFAULT 'single_elimination' NOT NULL,
	"max_entries" integer,
	"seed_count" integer DEFAULT 4 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"athlete_id" text NOT NULL,
	"athlete2_id" text,
	"seed" integer,
	"confirmed" boolean DEFAULT false NOT NULL,
	"withdrew" boolean DEFAULT false NOT NULL,
	"ranking_points_at_entry" integer,
	"final_placement" integer,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"level" "tournament_level" DEFAULT 'state' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"location" text,
	"city" text,
	"state" text,
	"points_table_id" text,
	"points_awarded" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_category_id_tournament_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tournament_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_registration1_id_tournament_registrations_id_fk" FOREIGN KEY ("registration1_id") REFERENCES "public"."tournament_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_registration2_id_tournament_registrations_id_fk" FOREIGN KEY ("registration2_id") REFERENCES "public"."tournament_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_athlete1_id_athletes_id_fk" FOREIGN KEY ("athlete1_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_athlete2_id_athletes_id_fk" FOREIGN KEY ("athlete2_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_rules" ADD CONSTRAINT "point_rules_ranking_id_rankings_id_fk" FOREIGN KEY ("ranking_id") REFERENCES "public"."rankings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_tables" ADD CONSTRAINT "points_tables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_ranking_id_rankings_id_fk" FOREIGN KEY ("ranking_id") REFERENCES "public"."rankings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_athlete2_id_athletes_id_fk" FOREIGN KEY ("athlete2_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_tournaments" ADD CONSTRAINT "ranking_tournaments_ranking_id_rankings_id_fk" FOREIGN KEY ("ranking_id") REFERENCES "public"."rankings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_tournaments" ADD CONSTRAINT "ranking_tournaments_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_category_id_tournament_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tournament_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_athlete2_id_athletes_id_fk" FOREIGN KEY ("athlete2_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_points_table_id_points_tables_id_fk" FOREIGN KEY ("points_table_id") REFERENCES "public"."points_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athletes_email_unique" ON "athletes" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_slug_unique" ON "clubs" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rankings_tenant_slug_unique" ON "rankings" USING btree ("tenant_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_slug_unique" ON "tournaments" USING btree ("slug") WHERE deleted_at IS NULL;