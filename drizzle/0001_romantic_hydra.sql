ALTER TABLE "reports_rs" ADD COLUMN "patient_nik_hash" text;--> statement-breakpoint
CREATE INDEX "reports_rs_nik_hash_idx" ON "reports_rs" USING btree ("patient_nik_hash");