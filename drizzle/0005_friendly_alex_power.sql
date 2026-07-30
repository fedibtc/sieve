ALTER TABLE "attachments" ALTER COLUMN "width" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "height" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "storage_provider" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;