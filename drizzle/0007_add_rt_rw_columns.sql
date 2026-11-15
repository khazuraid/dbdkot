ALTER TABLE "reports_pe" ADD COLUMN IF NOT EXISTS "rt" text;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN IF NOT EXISTS "rw" text;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN IF NOT EXISTS "rt" text;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN IF NOT EXISTS "rw" text;