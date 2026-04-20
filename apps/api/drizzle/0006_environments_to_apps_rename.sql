-- Rename environments table to apps
DO $$
BEGIN
  IF to_regclass('public.environments') IS NOT NULL
    AND to_regclass('public.apps') IS NULL THEN
    EXECUTE 'ALTER TABLE "environments" RENAME TO "apps"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename environment_members table to app_members
DO $$
BEGIN
  IF to_regclass('public.environment_members') IS NOT NULL
    AND to_regclass('public.app_members') IS NULL THEN
    EXECUTE 'ALTER TABLE "environment_members" RENAME TO "app_members"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename environment_production_addresses table to app_production_addresses
DO $$
BEGIN
  IF to_regclass('public.environment_production_addresses') IS NOT NULL
    AND to_regclass('public.app_production_addresses') IS NULL THEN
    EXECUTE 'ALTER TABLE "environment_production_addresses" RENAME TO "app_production_addresses"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename environment_id column to app_id in app_production_addresses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_production_addresses'
      AND column_name = 'environment_id'
  ) THEN
    EXECUTE 'ALTER TABLE "app_production_addresses" RENAME COLUMN "environment_id" TO "app_id"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename environment_id column to app_id in app_members
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_members'
      AND column_name = 'environment_id'
  ) THEN
    EXECUTE 'ALTER TABLE "app_members" RENAME COLUMN "environment_id" TO "app_id"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename environment_id column to app_id in feature_flags
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feature_flags'
      AND column_name = 'environment_id'
  ) THEN
    EXECUTE 'ALTER TABLE "feature_flags" RENAME COLUMN "environment_id" TO "app_id"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename environment_id column to app_id in flag_overrides
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flag_overrides'
      AND column_name = 'environment_id'
  ) THEN
    EXECUTE 'ALTER TABLE "flag_overrides" RENAME COLUMN "environment_id" TO "app_id"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename environment_id column to app_id in api_keys
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'environment_id'
  ) THEN
    EXECUTE 'ALTER TABLE "api_keys" RENAME COLUMN "environment_id" TO "app_id"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename indexes on apps (formerly environments)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environments_name_unique_idx') THEN
    EXECUTE 'ALTER INDEX "environments_name_unique_idx" RENAME TO "apps_name_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environments_owner_id_idx') THEN
    EXECUTE 'ALTER INDEX "environments_owner_id_idx" RENAME TO "apps_owner_id_idx"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename indexes on app_members (formerly environment_members)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environment_members_environment_user_unique_idx') THEN
    EXECUTE 'ALTER INDEX "environment_members_environment_user_unique_idx" RENAME TO "app_members_app_user_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environment_members_environment_role_idx') THEN
    EXECUTE 'ALTER INDEX "environment_members_environment_role_idx" RENAME TO "app_members_app_role_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environment_members_user_id_idx') THEN
    EXECUTE 'ALTER INDEX "environment_members_user_id_idx" RENAME TO "app_members_user_id_idx"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename indexes on app_production_addresses (formerly environment_production_addresses)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environment_production_addresses_environment_label_unique_idx') THEN
    EXECUTE 'ALTER INDEX "environment_production_addresses_environment_label_unique_idx" RENAME TO "app_production_addresses_app_label_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environment_production_addresses_environment_address_unique_idx') THEN
    EXECUTE 'ALTER INDEX "environment_production_addresses_environment_address_unique_idx" RENAME TO "app_production_addresses_app_address_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'environment_production_addresses_environment_id_idx') THEN
    EXECUTE 'ALTER INDEX "environment_production_addresses_environment_id_idx" RENAME TO "app_production_addresses_app_id_idx"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename feature_flags indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'feature_flags_environment_name_unique_idx') THEN
    EXECUTE 'ALTER INDEX "feature_flags_environment_name_unique_idx" RENAME TO "feature_flags_app_name_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'feature_flags_environment_id_idx') THEN
    EXECUTE 'ALTER INDEX "feature_flags_environment_id_idx" RENAME TO "feature_flags_app_id_idx"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename api_keys indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'api_keys_environment_id_idx') THEN
    EXECUTE 'ALTER INDEX "api_keys_environment_id_idx" RENAME TO "api_keys_app_id_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'api_keys_environment_expires_at_idx') THEN
    EXECUTE 'ALTER INDEX "api_keys_environment_expires_at_idx" RENAME TO "api_keys_app_expires_at_idx"';
  END IF;
END
$$;
--> statement-breakpoint

-- Rename flag_overrides indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'flag_overrides_environment_user_flag_unique_idx') THEN
    EXECUTE 'ALTER INDEX "flag_overrides_environment_user_flag_unique_idx" RENAME TO "flag_overrides_app_user_flag_unique_idx"';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'flag_overrides_environment_flag_idx') THEN
    EXECUTE 'ALTER INDEX "flag_overrides_environment_flag_idx" RENAME TO "flag_overrides_app_flag_idx"';
  END IF;
END
$$;
