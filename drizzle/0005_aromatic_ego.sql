CREATE TYPE "public"."review_origin" AS ENUM('authored', 'derived');--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "origin" "review_origin";--> statement-breakpoint
UPDATE "reviews" SET "origin" = CASE WHEN "agent_name" IS NOT NULL THEN 'authored'::"public"."review_origin" ELSE 'derived'::"public"."review_origin" END;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "origin" SET NOT NULL;
