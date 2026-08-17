CREATE TYPE "public"."review_run_outcome" AS ENUM('published', 'authored_only', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_run_step_kind" AS ENUM('tool', 'text', 'result');--> statement-breakpoint
CREATE TYPE "public"."review_run_trigger" AS ENUM('ci', 'local', 'unknown');--> statement-breakpoint
CREATE TABLE "review_run_steps" (
	"run_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" "review_run_step_kind" NOT NULL,
	"name" text,
	"target" text,
	"argument" text,
	"result_bytes" integer,
	"is_error" boolean DEFAULT false NOT NULL,
	"text" text,
	"at" timestamp with time zone,
	CONSTRAINT "review_run_steps_run_id_ordinal_pk" PRIMARY KEY("run_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "review_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text,
	"content_version" integer,
	"outcome" "review_run_outcome" NOT NULL,
	"repo" text NOT NULL,
	"branch" text NOT NULL,
	"head_sha" text,
	"pr_number" integer,
	"trigger" "review_run_trigger" DEFAULT 'unknown' NOT NULL,
	"model" text,
	"prompt_path" text,
	"prompt_sha256" text,
	"tool_version" text,
	"agent_version" text,
	"agent_session_ref" text,
	"hostname" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_ms" integer,
	"cost_usd_micros" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"turns" integer,
	"step_count" integer DEFAULT 0 NOT NULL,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"final_message" text,
	"transcript_attachment_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_run_steps" ADD CONSTRAINT "review_run_steps_run_id_review_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."review_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_runs" ADD CONSTRAINT "review_runs_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_runs" ADD CONSTRAINT "review_runs_transcript_attachment_id_attachments_id_fk" FOREIGN KEY ("transcript_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_runs" ADD CONSTRAINT "review_runs_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_run_steps_name_idx" ON "review_run_steps" USING btree ("name");--> statement-breakpoint
CREATE INDEX "review_run_steps_kind_idx" ON "review_run_steps" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "review_runs_review_version_idx" ON "review_runs" USING btree ("review_id","content_version");--> statement-breakpoint
CREATE INDEX "review_runs_repo_branch_idx" ON "review_runs" USING btree ("repo","branch");--> statement-breakpoint
CREATE INDEX "review_runs_created_at_idx" ON "review_runs" USING btree ("created_at");