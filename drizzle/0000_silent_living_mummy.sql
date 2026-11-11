CREATE TYPE "public"."CaseType" AS ENUM('DENGUE', 'SUSPECTED_DENGUE', 'DHF', 'DSS');--> statement-breakpoint
CREATE TYPE "public"."EntityType" AS ENUM('REPORT_RS', 'REPORT_PE', 'PE_TASK', 'KOREKSI_WILAYAH', 'USER', 'INSTITUTION');--> statement-breakpoint
CREATE TYPE "public"."EventCategory" AS ENUM('STATUS', 'VERIFICATION', 'ADMINISTRATION', 'INVESTIGATION', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."EventType" AS ENUM('REPORT_CREATED', 'REPORT_UPDATED', 'REPORT_DELETED', 'STATUS_CHANGE', 'VERIFICATION', 'CORRECTION', 'ASSIGNMENT', 'PE_TASK_CREATED', 'NOTIFICATION_SENT', 'COMMENT', 'ATTACHMENT', 'INVESTIGATION_STARTED', 'FINDINGS_RECORDED', 'DUE_DATE_UPDATED', 'PRIORITY_UPDATED', 'KOREKSI_REQUESTED', 'KOREKSI_SUBMITTED', 'KOREKSI_APPROVED', 'KOREKSI_REJECTED');--> statement-breakpoint
CREATE TYPE "public"."Gender" AS ENUM('L', 'P');--> statement-breakpoint
CREATE TYPE "public"."InstitutionType" AS ENUM('RUMAH_SAKIT', 'PUSKESMAS', 'DINAS_KESEHATAN');--> statement-breakpoint
CREATE TYPE "public"."ReportPEStatus" AS ENUM('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ReportRSStatus" AS ENUM('DRAFT', 'SUBMITTED', 'ASSIGNED', 'ASSIGNED_ACCEPTED', 'PUSKESMAS_REJECTED', 'PE_COMPLETED', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."RequestStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."RiskLevel" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."TaskPriority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."TaskStatus" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('ADMIN', 'DINKES', 'PUSKESMAS', 'RUMAH_SAKIT');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" "RequestStatus" DEFAULT 'PENDING' NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "asset_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"minimum_stock" integer DEFAULT 10 NOT NULL,
	"institution_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_rs_id" uuid,
	"report_pe_id" uuid,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"changes" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_reassignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_rs_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reassigned_by" uuid NOT NULL,
	"reassigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_rs_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_users_conversation_user_key" UNIQUE("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"report_id" text,
	"institution" text,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "EntityType" NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" "EventType" NOT NULL,
	"event_date" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"performed_by_id" uuid,
	"previous_value" text,
	"new_value" text,
	"metadata" jsonb,
	"category" "EventCategory" DEFAULT 'STATUS' NOT NULL,
	"related_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "InstitutionType" NOT NULL,
	"address" text,
	"province" text,
	"city" text,
	"district" text,
	"sub_district" text,
	"village" text,
	"phone_number" text,
	"phone" text,
	"latitude" double precision,
	"longitude" double precision,
	"kelurahan_list" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kelurahan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kecamatan" text NOT NULL,
	"kota" text NOT NULL,
	"provinsi" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_data_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pe_household_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_pe_id" uuid NOT NULL,
	"address" text NOT NULL,
	"house_count" integer NOT NULL,
	"population" integer NOT NULL,
	"larva_count" integer NOT NULL,
	"larva_type" text,
	"abate_used" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pe_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_pe_id" uuid NOT NULL,
	"assigned_puskesmas_id" uuid,
	"assigned_user_id" uuid,
	"created_by_id" uuid NOT NULL,
	"status" "TaskStatus" DEFAULT 'PENDING' NOT NULL,
	"priority" "TaskPriority" DEFAULT 'NORMAL' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_resource_action_key" UNIQUE("resource","action")
);
--> statement-breakpoint
CREATE TABLE "reports_pe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_rs_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"pe_date" timestamp with time zone NOT NULL,
	"investigation_date" timestamp with time zone,
	"investigator_name" text,
	"officer_name" text NOT NULL,
	"officer_id" uuid NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"house_index" numeric(5, 2),
	"container_index" numeric(5, 2),
	"breteau_index" numeric(5, 2),
	"source_investigation_done" boolean,
	"source_location" text,
	"form_data" jsonb,
	"conclusion" text,
	"recommendation" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "ReportPEStatus" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_pe_report_rs_id_unique" UNIQUE("report_rs_id")
);
--> statement-breakpoint
CREATE TABLE "reports_rs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_number" text NOT NULL,
	"patient_name_encrypted" text NOT NULL,
	"patient_nik_encrypted" text NOT NULL,
	"patient_birth_date" timestamp with time zone,
	"patient_address_encrypted" text NOT NULL,
	"patient_age" integer NOT NULL,
	"patient_gender" "Gender" NOT NULL,
	"case_type" "CaseType" NOT NULL,
	"phone_number" text,
	"initial_diagnosis" text,
	"final_diagnosis" text,
	"symptom_onset_date" timestamp with time zone,
	"admission_date" timestamp with time zone NOT NULL,
	"diagnosis_date" timestamp with time zone,
	"discharge_date" timestamp with time zone,
	"discharge_status" text,
	"fever" text,
	"bleeding" text,
	"tourniquet_test" text,
	"hepatomegaly" text,
	"shock" text,
	"platelet_count" integer,
	"hematocrit" numeric(5, 2),
	"dengue_blot" text,
	"igg" text,
	"igm" text,
	"diagnosis" text,
	"kota" text,
	"provinsi" text,
	"kelurahan" text,
	"kecamatan" text,
	"institution_id" uuid NOT NULL,
	"assigned_puskesmas_id" uuid,
	"created_by_id" uuid NOT NULL,
	"assigned_to_id" uuid,
	"updated_by_id" uuid,
	"status" "ReportRSStatus" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"puskesmas_reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"rejection_category" text,
	"rejected_by" uuid,
	CONSTRAINT "reports_rs_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "risk_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_type" text NOT NULL,
	"prediction_data" jsonb NOT NULL,
	"risk_level" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"created_by_id" uuid NOT NULL,
	"model_version" text,
	"features_used" jsonb,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"role" "UserRole" DEFAULT 'PUSKESMAS' NOT NULL,
	"institution_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_report_rs_id_reports_rs_id_fk" FOREIGN KEY ("report_rs_id") REFERENCES "public"."reports_rs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_report_pe_id_reports_pe_id_fk" FOREIGN KEY ("report_pe_id") REFERENCES "public"."reports_pe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_report_rs_id_reports_rs_id_fk" FOREIGN KEY ("report_rs_id") REFERENCES "public"."reports_rs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_users" ADD CONSTRAINT "conversation_users_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_users" ADD CONSTRAINT "conversation_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_history" ADD CONSTRAINT "entity_history_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pe_household_surveys" ADD CONSTRAINT "pe_household_surveys_report_pe_id_reports_pe_id_fk" FOREIGN KEY ("report_pe_id") REFERENCES "public"."reports_pe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pe_tasks" ADD CONSTRAINT "pe_tasks_report_pe_id_reports_pe_id_fk" FOREIGN KEY ("report_pe_id") REFERENCES "public"."reports_pe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pe_tasks" ADD CONSTRAINT "pe_tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pe_tasks" ADD CONSTRAINT "pe_tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD CONSTRAINT "reports_pe_report_rs_id_reports_rs_id_fk" FOREIGN KEY ("report_rs_id") REFERENCES "public"."reports_rs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD CONSTRAINT "reports_pe_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD CONSTRAINT "reports_pe_officer_id_users_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD CONSTRAINT "reports_pe_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_pe" ADD CONSTRAINT "reports_pe_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD CONSTRAINT "reports_rs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD CONSTRAINT "reports_rs_assigned_puskesmas_id_institutions_id_fk" FOREIGN KEY ("assigned_puskesmas_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD CONSTRAINT "reports_rs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD CONSTRAINT "reports_rs_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports_rs" ADD CONSTRAINT "reports_rs_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_predictions" ADD CONSTRAINT "risk_predictions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "asset_requests_asset_idx" ON "asset_requests" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_requests_institution_idx" ON "asset_requests" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "asset_requests_status_idx" ON "asset_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "asset_transactions_asset_idx" ON "asset_transactions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "assets_code_idx" ON "assets" USING btree ("code");--> statement-breakpoint
CREATE INDEX "assets_institution_idx" ON "assets" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "attachments_report_rs_idx" ON "attachments" USING btree ("report_rs_id");--> statement-breakpoint
CREATE INDEX "attachments_report_pe_idx" ON "attachments" USING btree ("report_pe_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "case_reassignments_report_rs_idx" ON "case_reassignments" USING btree ("report_rs_id");--> statement-breakpoint
CREATE INDEX "comments_report_rs_idx" ON "comments" USING btree ("report_rs_id");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_users_user_idx" ON "conversation_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_quality_alerts_resolved_idx" ON "data_quality_alerts" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "entity_history_entity_idx" ON "entity_history" USING btree ("entity_type","entity_id","event_date");--> statement-breakpoint
CREATE INDEX "entity_history_performer_idx" ON "entity_history" USING btree ("performed_by_id");--> statement-breakpoint
CREATE INDEX "entity_history_related_report_idx" ON "entity_history" USING btree ("related_report_id");--> statement-breakpoint
CREATE INDEX "institutions_type_idx" ON "institutions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "kelurahan_kecamatan_idx" ON "kelurahan" USING btree ("kecamatan");--> statement-breakpoint
CREATE INDEX "kelurahan_kota_idx" ON "kelurahan" USING btree ("kota");--> statement-breakpoint
CREATE INDEX "master_data_type_idx" ON "master_data" USING btree ("type");--> statement-breakpoint
CREATE INDEX "master_data_parent_idx" ON "master_data" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "pe_household_surveys_report_pe_idx" ON "pe_household_surveys" USING btree ("report_pe_id");--> statement-breakpoint
CREATE INDEX "pe_tasks_report_pe_idx" ON "pe_tasks" USING btree ("report_pe_id");--> statement-breakpoint
CREATE INDEX "pe_tasks_assigned_user_idx" ON "pe_tasks" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "pe_tasks_status_idx" ON "pe_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_pe_report_rs_idx" ON "reports_pe" USING btree ("report_rs_id");--> statement-breakpoint
CREATE INDEX "reports_pe_institution_idx" ON "reports_pe" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "reports_rs_institution_idx" ON "reports_rs" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "reports_rs_assigned_idx" ON "reports_rs" USING btree ("assigned_puskesmas_id");--> statement-breakpoint
CREATE INDEX "reports_rs_status_idx" ON "reports_rs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_rs_updated_at_idx" ON "reports_rs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "risk_predictions_model_type_idx" ON "risk_predictions" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "risk_predictions_target_idx" ON "risk_predictions" USING btree ("target_id","target_type");--> statement-breakpoint
CREATE INDEX "risk_predictions_risk_level_idx" ON "risk_predictions" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "risk_predictions_created_at_idx" ON "risk_predictions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_institution_idx" ON "users" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");