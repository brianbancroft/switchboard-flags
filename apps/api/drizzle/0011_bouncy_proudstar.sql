ALTER TABLE "api_keys" ADD COLUMN "environment_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_environment_id_app_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."app_environments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "api_keys_environment_id_idx" ON "api_keys" USING btree ("environment_id");