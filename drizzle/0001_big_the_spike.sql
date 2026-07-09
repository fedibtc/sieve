CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" bytea NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_sha256_idx" ON "attachments" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "attachments_created_by_user_idx" ON "attachments" USING btree ("created_by_user_id");
