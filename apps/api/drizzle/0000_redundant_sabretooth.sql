CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."environment_member_role" AS ENUM('admin', 'write', 'read');--> statement-breakpoint
CREATE TYPE "public"."environment_type" AS ENUM('production', 'staging', 'nightly', 'dev');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment_id" uuid NOT NULL,
	"hashed_key" text NOT NULL,
	"description" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url_pattern" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "environment_member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"type" "environment_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{"type":"boolean","defaultValue":false,"rules":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_environment_id_id_unique" UNIQUE("environment_id","id"),
	CONSTRAINT "feature_flags_name_format_check" CHECK ("feature_flags"."name" ~ '^[a-z]+(?:_[a-z]+)*$')
);
--> statement-breakpoint
CREATE TABLE "flag_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"is_mega_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "environment_clients" ADD CONSTRAINT "environment_clients_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "environment_members" ADD CONSTRAINT "environment_members_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "environment_members" ADD CONSTRAINT "environment_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flag_overrides" ADD CONSTRAINT "flag_overrides_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flag_overrides" ADD CONSTRAINT "flag_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flag_overrides" ADD CONSTRAINT "flag_overrides_environment_flag_fk" FOREIGN KEY ("environment_id","flag_id") REFERENCES "public"."feature_flags"("environment_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hashed_key_unique_idx" ON "api_keys" USING btree ("hashed_key");--> statement-breakpoint
CREATE INDEX "api_keys_environment_id_idx" ON "api_keys" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "api_keys_environment_expires_at_idx" ON "api_keys" USING btree ("environment_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_clients_environment_label_unique_idx" ON "environment_clients" USING btree ("environment_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_clients_environment_url_pattern_unique_idx" ON "environment_clients" USING btree ("environment_id","url_pattern");--> statement-breakpoint
CREATE INDEX "environment_clients_environment_id_idx" ON "environment_clients" USING btree ("environment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_members_environment_user_unique_idx" ON "environment_members" USING btree ("environment_id","user_id");--> statement-breakpoint
CREATE INDEX "environment_members_environment_role_idx" ON "environment_members" USING btree ("environment_id","role");--> statement-breakpoint
CREATE INDEX "environment_members_user_id_idx" ON "environment_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environments_name_unique_idx" ON "environments" USING btree ("name");--> statement-breakpoint
CREATE INDEX "environments_owner_id_idx" ON "environments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "environments_type_idx" ON "environments" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_environment_name_unique_idx" ON "feature_flags" USING btree ("environment_id","name");--> statement-breakpoint
CREATE INDEX "feature_flags_environment_id_idx" ON "feature_flags" USING btree ("environment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flag_overrides_environment_user_flag_unique_idx" ON "flag_overrides" USING btree ("environment_id","user_id","flag_id");--> statement-breakpoint
CREATE INDEX "flag_overrides_flag_id_idx" ON "flag_overrides" USING btree ("flag_id");--> statement-breakpoint
CREATE INDEX "flag_overrides_user_id_idx" ON "flag_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_mega_admin_idx" ON "users" USING btree ("is_mega_admin");
