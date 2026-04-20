CREATE TABLE "app_configuration" (
	"id" uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL,
	"auth_password_enabled" boolean DEFAULT true NOT NULL,
	"auth_github_enabled" boolean DEFAULT false NOT NULL,
	"auth_google_enabled" boolean DEFAULT false NOT NULL,
	"auth_apple_enabled" boolean DEFAULT false NOT NULL,
	"auth_meta_enabled" boolean DEFAULT false NOT NULL,
	"auth_oidc_enabled" boolean DEFAULT false NOT NULL,
	"github_client_id" text,
	"github_client_secret" text,
	"google_client_id" text,
	"google_client_secret" text,
	"apple_client_id" text,
	"apple_client_secret" text,
	"meta_client_id" text,
	"meta_client_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"issuer_url" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "oidc_providers_slug_unique_idx" ON "oidc_providers" USING btree ("slug");