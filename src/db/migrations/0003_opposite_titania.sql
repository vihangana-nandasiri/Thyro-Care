ALTER TABLE "users" ADD COLUMN "mfa_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "mfa_required" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "educational_resources" ADD COLUMN "doctor_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "educational_resources" ADD COLUMN "doctor_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "educational_resources" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "educational_resources" SET "status" = 'pending' WHERE "status" = 'approved';--> statement-breakpoint
ALTER TABLE "educational_resources" ADD CONSTRAINT "educational_resources_doctor_approved_by_users_id_fk" FOREIGN KEY ("doctor_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
