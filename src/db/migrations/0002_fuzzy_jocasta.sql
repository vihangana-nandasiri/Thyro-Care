CREATE TYPE "public"."resource_kind" AS ENUM('article', 'news', 'video');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "educational_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"kind" "resource_kind" NOT NULL,
	"language" "language" DEFAULT 'en' NOT NULL,
	"status" "resource_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "ui_spec" jsonb;--> statement-breakpoint
ALTER TABLE "educational_resources" ADD CONSTRAINT "educational_resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educational_resources" ADD CONSTRAINT "educational_resources_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;