CREATE TABLE "dev_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"environments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apps" DROP CONSTRAINT IF EXISTS "apps_saturation_percent_range_check";--> statement-breakpoint
ALTER TABLE "dev_overrides" ADD CONSTRAINT "dev_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dev_overrides" ADD CONSTRAINT "dev_overrides_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "dev_overrides_user_app_unique_idx" ON "dev_overrides" USING btree ("user_id","app_id");--> statement-breakpoint
CREATE INDEX "dev_overrides_user_id_idx" ON "dev_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dev_overrides_app_id_idx" ON "dev_overrides" USING btree ("app_id");--> statement-breakpoint
ALTER TABLE "apps" DROP COLUMN IF EXISTS "saturation_percent";
