ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'CROSS_BORDER_PENDING' BEFORE 'ASSIGNED';--> statement-breakpoint
ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'ARCHIVED_CROSS_BORDER' BEFORE 'ASSIGNED';--> statement-breakpoint
ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'PE_IN_PROGRESS' BEFORE 'PE_COMPLETED';--> statement-breakpoint
ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'FOGGING_REQUIRED' BEFORE 'REJECTED';--> statement-breakpoint
ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'SIKLUS_1_DONE' BEFORE 'REJECTED';--> statement-breakpoint
ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'SIKLUS_2_SCHEDULED' BEFORE 'REJECTED';--> statement-breakpoint
ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'SIKLUS_2_DONE' BEFORE 'REJECTED';--> statement-breakpoint
ALTER TYPE "public"."ReportRSStatus" ADD VALUE 'CLOSED' BEFORE 'REJECTED';--> statement-breakpoint
CREATE TABLE "fogging_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_rs_id" uuid NOT NULL,
	"report_pe_id" uuid,
	"institution_id" uuid NOT NULL,
	"cycle_number" integer NOT NULL,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"abate_used_kg" numeric(8, 2) DEFAULT '0' NOT NULL,
	"insecticide_used_liter" numeric(8, 2) DEFAULT '0' NOT NULL,
	"fogger_machines_count" integer DEFAULT 1 NOT NULL,
	"material_cost" integer DEFAULT 0 NOT NULL,
	"honor_cost" integer DEFAULT 0 NOT NULL,
	"maintenance_cost" integer DEFAULT 0 NOT NULL,
	"total_budget" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"executed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fogging_cycles_report_cycle_key" UNIQUE("report_rs_id","cycle_number")
);
--> statement-breakpoint
CREATE TABLE "wa_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_role" text,
	"institution_id" uuid,
	"report_rs_id" uuid,
	"event_kind" text NOT NULL,
	"message" text NOT NULL,
	"provider_mode" text DEFAULT 'LOCAL_FALLBACK' NOT NULL,
	"delivery_status" text DEFAULT 'FALLBACK_LOGGED' NOT NULL,
	"response_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "abj" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "houses_inspected" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "houses_positive" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "containers_inspected" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "containers_positive" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "other_fever_cases_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "transmission_risk" text;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "fogging_recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "respondent_name" text;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "respondent_relation" text;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "travel_history_14d" text;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "officer_nip" text;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "head_of_puskesmas_name" text;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD COLUMN "head_of_puskesmas_nip" text;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "cluster_id" uuid;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "source_type" text DEFAULT 'RS' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "cross_border_target_city" text;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "cross_border_notes" text;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_opt_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "fogging_cycles" ADD CONSTRAINT "fogging_cycles_report_rs_id_reports_rs_id_fk" FOREIGN KEY ("report_rs_id") REFERENCES "public"."reports_rs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fogging_cycles" ADD CONSTRAINT "fogging_cycles_report_pe_id_reports_pe_id_fk" FOREIGN KEY ("report_pe_id") REFERENCES "public"."reports_pe"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fogging_cycles" ADD CONSTRAINT "fogging_cycles_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fogging_cycles" ADD CONSTRAINT "fogging_cycles_executed_by_id_users_id_fk" FOREIGN KEY ("executed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_dispatches" ADD CONSTRAINT "wa_dispatches_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_dispatches" ADD CONSTRAINT "wa_dispatches_report_rs_id_reports_rs_id_fk" FOREIGN KEY ("report_rs_id") REFERENCES "public"."reports_rs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fogging_cycles_report_idx" ON "fogging_cycles" USING btree ("report_rs_id");--> statement-breakpoint
CREATE INDEX "fogging_cycles_institution_idx" ON "fogging_cycles" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "fogging_cycles_status_idx" ON "fogging_cycles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_dispatches_report_idx" ON "wa_dispatches" USING btree ("report_rs_id");--> statement-breakpoint
CREATE INDEX "wa_dispatches_institution_idx" ON "wa_dispatches" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "wa_dispatches_created_idx" ON "wa_dispatches" USING btree ("created_at");