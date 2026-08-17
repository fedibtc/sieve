import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { reviewRunSteps, reviewRuns, reviews } from "@/server/db/schema";

export const MAX_RUN_STEPS = 2000;
const TARGET_LIMIT = 500;
const ARGUMENT_LIMIT = 2000;
const TEXT_LIMIT = 20000;

export type ReviewRunStepInput = {
  kind: "tool" | "text" | "result";
  name?: string | null;
  target?: string | null;
  argument?: string | null;
  resultBytes?: number | null;
  isError?: boolean;
  text?: string | null;
  at?: string | null;
};

export type RecordReviewRunInput = {
  reviewId?: string | null;
  contentVersion?: number | null;
  outcome: "published" | "authored_only" | "failed";
  repo: string;
  branch: string;
  headSha?: string | null;
  prNumber?: number | null;
  trigger?: "ci" | "local" | "unknown";
  model?: string | null;
  promptPath?: string | null;
  promptSha256?: string | null;
  toolVersion?: string | null;
  agentVersion?: string | null;
  agentSessionRef?: string | null;
  hostname?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMs?: number | null;
  costUsdMicros?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  turns?: number | null;
  inputs?: Record<string, unknown>;
  result?: Record<string, unknown>;
  finalMessage?: string | null;
  transcriptAttachmentId?: string | null;
  steps: ReviewRunStepInput[];
  createdByUserId: string;
};

export async function recordReviewRun(input: RecordReviewRunInput) {
  if (input.reviewId) {
    const [review] = await (await getDb())
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.id, input.reviewId))
      .limit(1);
    if (!review) {
      throw new Error("Review not found");
    }
  }
  if (input.contentVersion != null && !input.reviewId) {
    throw new Error("contentVersion requires a reviewId");
  }
  if (input.steps.length > MAX_RUN_STEPS) {
    throw new Error(`A run carries at most ${MAX_RUN_STEPS} steps`);
  }

  const db = await getDb();
  const [run] = await db
    .insert(reviewRuns)
    .values({
      reviewId: input.reviewId ?? null,
      contentVersion: input.contentVersion ?? null,
      outcome: input.outcome,
      repo: input.repo,
      branch: input.branch,
      headSha: input.headSha ?? null,
      prNumber: input.prNumber ?? null,
      trigger: input.trigger ?? "unknown",
      model: input.model ?? null,
      promptPath: input.promptPath ?? null,
      promptSha256: input.promptSha256 ?? null,
      toolVersion: input.toolVersion ?? null,
      agentVersion: input.agentVersion ?? null,
      agentSessionRef: input.agentSessionRef ?? null,
      hostname: input.hostname ?? null,
      startedAt: toDate(input.startedAt),
      endedAt: toDate(input.endedAt),
      durationMs: input.durationMs ?? null,
      costUsdMicros: input.costUsdMicros ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      turns: input.turns ?? null,
      stepCount: input.steps.length,
      inputs: input.inputs ?? {},
      result: input.result ?? {},
      finalMessage: truncate(input.finalMessage, TEXT_LIMIT),
      transcriptAttachmentId: input.transcriptAttachmentId ?? null,
      createdByUserId: input.createdByUserId,
    })
    // recording the same version twice is a retry, not an error
    .onConflictDoUpdate({
      target: [reviewRuns.reviewId, reviewRuns.contentVersion],
      set: {
        outcome: sql`excluded.outcome`,
        model: sql`excluded.model`,
        promptSha256: sql`excluded.prompt_sha256`,
        stepCount: sql`excluded.step_count`,
        inputs: sql`excluded.inputs`,
        result: sql`excluded.result`,
        finalMessage: sql`excluded.final_message`,
        transcriptAttachmentId: sql`excluded.transcript_attachment_id`,
        durationMs: sql`excluded.duration_ms`,
        createdAt: sql`now()`,
      },
    })
    .returning();

  await db.delete(reviewRunSteps).where(eq(reviewRunSteps.runId, run.id));
  if (input.steps.length > 0) {
    await db.insert(reviewRunSteps).values(
      input.steps.map((step, ordinal) => ({
        runId: run.id,
        ordinal,
        kind: step.kind,
        name: truncate(step.name, TARGET_LIMIT),
        target: truncate(step.target, TARGET_LIMIT),
        argument: truncate(step.argument, ARGUMENT_LIMIT),
        resultBytes: step.resultBytes ?? null,
        isError: step.isError ?? false,
        text: truncate(step.text, TEXT_LIMIT),
        at: toDate(step.at),
      })),
    );
  }
  return run;
}

export async function getReviewRun(runId: string) {
  const db = await getDb();
  const [run] = await db
    .select()
    .from(reviewRuns)
    .where(eq(reviewRuns.id, runId))
    .limit(1);
  if (!run) {
    return null;
  }
  const steps = await db
    .select()
    .from(reviewRunSteps)
    .where(eq(reviewRunSteps.runId, runId))
    .orderBy(reviewRunSteps.ordinal);
  return { ...run, steps };
}

export async function listReviewRuns(filters?: {
  repo?: string | null;
  branch?: string | null;
  reviewId?: string | null;
  outcome?: "published" | "authored_only" | "failed" | null;
  trigger?: "ci" | "local" | "unknown" | null;
  limit?: number | null;
}) {
  const db = await getDb();
  const where = and(
    filters?.repo ? eq(reviewRuns.repo, filters.repo) : undefined,
    filters?.branch ? eq(reviewRuns.branch, filters.branch) : undefined,
    filters?.reviewId ? eq(reviewRuns.reviewId, filters.reviewId) : undefined,
    filters?.outcome ? eq(reviewRuns.outcome, filters.outcome) : undefined,
    filters?.trigger ? eq(reviewRuns.trigger, filters.trigger) : undefined,
  );
  return db
    .select()
    .from(reviewRuns)
    .where(where)
    .orderBy(desc(reviewRuns.createdAt))
    .limit(Math.min(filters?.limit ?? 50, 200));
}

export async function getReviewRunForVersion(
  reviewId: string,
  contentVersion: number,
) {
  const db = await getDb();
  const [run] = await db
    .select({ id: reviewRuns.id })
    .from(reviewRuns)
    .where(
      and(
        eq(reviewRuns.reviewId, reviewId),
        eq(reviewRuns.contentVersion, contentVersion),
      ),
    )
    .limit(1);
  return run ? getReviewRun(run.id) : null;
}

export async function countToolUse(filters?: { repo?: string | null }) {
  const db = await getDb();
  return db
    .select({ name: reviewRunSteps.name, uses: count(reviewRunSteps.ordinal) })
    .from(reviewRunSteps)
    .innerJoin(reviewRuns, eq(reviewRuns.id, reviewRunSteps.runId))
    .where(
      and(
        eq(reviewRunSteps.kind, "tool"),
        filters?.repo ? eq(reviewRuns.repo, filters.repo) : undefined,
      ),
    )
    .groupBy(reviewRunSteps.name)
    .orderBy(desc(count(reviewRunSteps.ordinal)));
}

function truncate(value: string | null | undefined, limit: number) {
  if (value == null) {
    return null;
  }
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function toDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
