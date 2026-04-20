ALTER TABLE "app_environments" ADD COLUMN "is_dev" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "app_environments_app_dev_unique_idx" ON "app_environments" USING btree ("app_id") WHERE "app_environments"."is_dev" = true;--> statement-breakpoint
INSERT INTO "app_environments" ("app_id", "name", "is_dev", "enabled", "position")
SELECT "id", 'dev', true, true, -1 FROM "apps";