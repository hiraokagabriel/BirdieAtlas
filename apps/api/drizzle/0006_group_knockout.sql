ALTER TABLE "draws" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "group_key" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "stage" text;