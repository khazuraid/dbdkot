CREATE TYPE "public"."AccountStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "AccountStatus" DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");