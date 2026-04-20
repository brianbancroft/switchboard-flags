-- Per-environment monotonic flags version. Bumped by the application on any
-- change that could affect the payload an SDK client sees (flag config/rules,
-- per-env values, environment address/enabled/dev flag, or production address).
-- Redis mirrors this value at `sb:version:{appId}:{envId}` for fast reads.

ALTER TABLE "app_environments"
  ADD COLUMN IF NOT EXISTS "flags_version" bigint NOT NULL DEFAULT 1;
