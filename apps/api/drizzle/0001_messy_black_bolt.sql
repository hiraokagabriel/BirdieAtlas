CREATE TYPE "public"."category_type" AS ENUM('MS', 'WS', 'MD', 'WD', 'XD');--> statement-breakpoint
CREATE TYPE "public"."draw_type" AS ENUM('single_elimination', 'round_robin', 'group_then_elimination');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'in_progress', 'completed', 'walkover', 'retired');--> statement-breakpoint
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
CREATE TABLE "draws" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
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
	"points" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"category_type" "category_type" NOT NULL,
	"year" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"category_type" "category_type" NOT NULL,
	"draw_type" "draw_type" DEFAULT 'single_elimination' NOT NULL,
	"max_entries" integer,
	"seed_count" integer DEFAULT 4 NOT NULL,
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
	"level" text DEFAULT 'estadual' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"location" text,
	"city" text,
	"state" text,
	"points_table_id" text,
	"ranking_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "athletes" DROP CONSTRAINT "athletes_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "athletes" DROP CONSTRAINT "athletes_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "gender" "gender" NOT NULL;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "nationality" text DEFAULT 'BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "country" text DEFAULT 'BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_affiliations" ADD CONSTRAINT "athlete_affiliations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_category_id_tournament_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tournament_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_registration1_id_tournament_registrations_id_fk" FOREIGN KEY ("registration1_id") REFERENCES "public"."tournament_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_registration2_id_tournament_registrations_id_fk" FOREIGN KEY ("registration2_id") REFERENCES "public"."tournament_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_tables" ADD CONSTRAINT "points_tables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_ranking_id_rankings_id_fk" FOREIGN KEY ("ranking_id") REFERENCES "public"."rankings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_athlete2_id_athletes_id_fk" FOREIGN KEY ("athlete2_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_category_id_tournament_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tournament_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_athlete2_id_athletes_id_fk" FOREIGN KEY ("athlete2_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_points_table_id_points_tables_id_fk" FOREIGN KEY ("points_table_id") REFERENCES "public"."points_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_ranking_id_rankings_id_fk" FOREIGN KEY ("ranking_id") REFERENCES "public"."rankings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athletes" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "athletes" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_slug_unique" UNIQUE("slug");