CREATE TABLE IF NOT EXISTS "app_environments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE cascade ON UPDATE cascade,
  "name" text NOT NULL,
  "address" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_environments_app_name_unique_idx"
  ON "app_environments" USING btree ("app_id", "name");

CREATE INDEX IF NOT EXISTS "app_environments_app_id_idx"
  ON "app_environments" USING btree ("app_id");

CREATE INDEX IF NOT EXISTS "app_environments_app_position_idx"
  ON "app_environments" USING btree ("app_id", "position");
