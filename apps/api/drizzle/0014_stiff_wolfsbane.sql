-- Extend flag_audit_log for app-level activity tracking.
-- Also creates flag_environment_values / flag_audit_log for fresh installs
-- that never applied the manually-written 0013 migration.

-- flag_environment_values (idempotent — safe if table already exists from 0013)
CREATE TABLE IF NOT EXISTS "flag_environment_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "flag_id" uuid NOT NULL,
  "app_id" uuid NOT NULL,
  "environment_id" uuid NOT NULL,
  "value" jsonb NOT NULL,
  "changed_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flag_env_values_app_flag_fk') THEN
    ALTER TABLE "flag_environment_values" ADD CONSTRAINT "flag_env_values_app_flag_fk" FOREIGN KEY ("app_id","flag_id") REFERENCES "public"."feature_flags"("app_id","id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flag_env_values_env_fk') THEN
    ALTER TABLE "flag_environment_values" ADD CONSTRAINT "flag_env_values_env_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."app_environments"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flag_env_values_user_fk') THEN
    ALTER TABLE "flag_environment_values" ADD CONSTRAINT "flag_env_values_user_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "flag_env_values_flag_env_unique_idx" ON "flag_environment_values" ("flag_id","environment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flag_env_values_app_flag_idx" ON "flag_environment_values" ("app_id","flag_id");
--> statement-breakpoint

-- flag_audit_log with final schema (new columns already included for fresh installs)
CREATE TABLE IF NOT EXISTS "flag_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action_type" text NOT NULL DEFAULT 'flag_value_changed',
  "flag_id" uuid,
  "flag_name" text,
  "app_id" uuid NOT NULL,
  "environment_id" uuid,
  "changed_by_user_id" uuid,
  "old_value" jsonb,
  "new_value" jsonb,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Upgrade path: add new columns if upgrading from the old 0013 structure
ALTER TABLE "flag_audit_log" ADD COLUMN IF NOT EXISTS "action_type" text NOT NULL DEFAULT 'flag_value_changed';
--> statement-breakpoint
ALTER TABLE "flag_audit_log" ADD COLUMN IF NOT EXISTS "flag_name" text;
--> statement-breakpoint

-- Make columns nullable (idempotent — safe even if already nullable)
ALTER TABLE "flag_audit_log" ALTER COLUMN "flag_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "flag_audit_log" ALTER COLUMN "environment_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "flag_audit_log" ALTER COLUMN "new_value" DROP NOT NULL;
--> statement-breakpoint

-- Drop old composite FK and environment FK (had ON DELETE CASCADE — replaced below)
ALTER TABLE "flag_audit_log" DROP CONSTRAINT IF EXISTS "flag_audit_log_app_flag_fk";
--> statement-breakpoint
ALTER TABLE "flag_audit_log" DROP CONSTRAINT IF EXISTS "flag_audit_log_env_fk";
--> statement-breakpoint

-- Add/replace FKs with correct SET NULL behaviour
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flag_audit_log_flag_id_feature_flags_id_fk') THEN
    ALTER TABLE "flag_audit_log" ADD CONSTRAINT "flag_audit_log_flag_id_feature_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flag_audit_log_app_id_apps_id_fk') THEN
    ALTER TABLE "flag_audit_log" ADD CONSTRAINT "flag_audit_log_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flag_audit_log_environment_id_app_environments_id_fk') THEN
    ALTER TABLE "flag_audit_log" ADD CONSTRAINT "flag_audit_log_environment_id_app_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."app_environments"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flag_audit_log_changed_by_user_id_users_id_fk') THEN
    ALTER TABLE "flag_audit_log" ADD CONSTRAINT "flag_audit_log_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;
--> statement-breakpoint

-- Update indexes
DROP INDEX IF EXISTS "flag_audit_log_changed_at_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flag_audit_log_flag_id_idx" ON "flag_audit_log" ("flag_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flag_audit_log_app_id_changed_at_idx" ON "flag_audit_log" ("app_id","changed_at");
