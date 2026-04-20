DO $$
BEGIN
  IF to_regclass('public.environment_clients') IS NOT NULL
    AND to_regclass('public.environment_production_addresses') IS NULL THEN
    EXECUTE 'ALTER TABLE "environment_clients" RENAME TO "environment_production_addresses"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'environment_production_addresses'
      AND column_name = 'url_pattern'
  ) THEN
    EXECUTE 'ALTER TABLE "environment_production_addresses" RENAME COLUMN "url_pattern" TO "address"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'environment_clients_environment_label_unique_idx'
  ) THEN
    EXECUTE 'ALTER INDEX "environment_clients_environment_label_unique_idx" RENAME TO "environment_production_addresses_environment_label_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'environment_clients_environment_url_pattern_unique_idx'
  ) THEN
    EXECUTE 'ALTER INDEX "environment_clients_environment_url_pattern_unique_idx" RENAME TO "environment_production_addresses_environment_address_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'environment_clients_environment_id_idx'
  ) THEN
    EXECUTE 'ALTER INDEX "environment_clients_environment_id_idx" RENAME TO "environment_production_addresses_environment_id_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'environment_clients_environment_id_environments_id_fk'
  ) THEN
    EXECUTE 'ALTER TABLE "environment_production_addresses" RENAME CONSTRAINT "environment_clients_environment_id_environments_id_fk" TO "environment_production_addresses_environment_id_environments_id_fk"';
  END IF;
END
$$;
--> statement-breakpoint
DROP INDEX IF EXISTS "environments_type_idx";
--> statement-breakpoint
ALTER TABLE "environments" DROP COLUMN IF EXISTS "type";
--> statement-breakpoint
DROP TYPE IF EXISTS "environment_type";
--> statement-breakpoint
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "staging_address" text;
--> statement-breakpoint
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "nightly_address" text;
--> statement-breakpoint
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "saturation_percent" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'environments_saturation_percent_range_check'
  ) THEN
    EXECUTE 'ALTER TABLE "environments" ADD CONSTRAINT "environments_saturation_percent_range_check" CHECK ("environments"."saturation_percent" >= 0 AND "environments"."saturation_percent" <= 100)';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'environment_member_role'
      AND e.enumlabel IN ('write', 'read')
  ) THEN
    EXECUTE 'ALTER TYPE "environment_member_role" RENAME TO "environment_member_role_old"';
    EXECUTE 'CREATE TYPE "environment_member_role" AS ENUM (''admin'', ''manager'', ''developer'')';
    EXECUTE $migration$
      ALTER TABLE "environment_members"
      ALTER COLUMN "role" TYPE "environment_member_role"
      USING (
        CASE "role"::text
          WHEN 'admin' THEN 'admin'
          WHEN 'write' THEN 'manager'
          WHEN 'read' THEN 'developer'
        END
      )::"environment_member_role"
    $migration$;
    EXECUTE 'DROP TYPE "environment_member_role_old"';
  END IF;
END
$$;
