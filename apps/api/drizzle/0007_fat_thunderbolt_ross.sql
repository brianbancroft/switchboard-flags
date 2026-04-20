-- 0006 already renames the legacy environment tables, columns, and indexes to
-- the final app-based names. Keeping this migration as a no-op preserves the
-- generated migration history without trying to recreate tables that now exist.
SELECT 1;
