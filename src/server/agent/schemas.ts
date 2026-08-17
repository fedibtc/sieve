import { z } from "zod";
import { anchorSchema } from "@/shared/anchors";
import { reviewDocumentSchema } from "@/shared/blocks";

export const publishReviewInput = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  summary: z.string().optional().nullable(),
  origin: z.enum(["authored", "derived"]),
  repo: z.string().min(1),
  branch: z.string().min(1),
  baseRef: z.string().optional().nullable(),
  headSha: z.string().optional().nullable(),
  prNumber: z.number().int().positive().optional().nullable(),
  prUrl: z.string().url().optional().nullable(),
  content: reviewDocumentSchema,
  idempotencyKey: z.string().min(1),
  agentName: z.string().optional().nullable(),
  changeNote: z.string().optional().nullable(),
});

export const reviewIdInput = z.object({
  reviewId: z.string().min(1),
});

export const consumeFeedbackInput = reviewIdInput.extend({
  commentIds: z.array(z.string().min(1)).optional(),
});

export const replyInput = z.object({
  reviewId: z.string().min(1),
  commentId: z.string().min(1),
  message: z.string().min(1),
});

export const resolveInput = z.object({
  reviewId: z.string().min(1),
  commentId: z.string().min(1),
  message: z.string().min(1).optional(),
});

export const statusInput = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["open", "archived"]),
});

export const sessionInput = z.object({
  reviewId: z.string().min(1).optional().nullable(),
  repo: z.string().min(1),
  branch: z.string().min(1),
  agentKind: z.enum(["claude-code", "codex", "other"]),
  hostname: z.string().min(1),
  workspacePath: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const endSessionInput = z.object({
  sessionId: z.string().min(1),
});

export const commentInput = z.object({
  reviewId: z.string().min(1),
  message: z.string().min(1),
  anchor: anchorSchema.nullable().optional(),
  resolutionTarget: z.enum(["agent", "human"]).default("agent"),
});

export const listReviewsInput = z.object({
  repo: z.string().min(1).optional().nullable(),
  status: z
    .enum(["open", "approved", "changes_requested", "archived"])
    .optional()
    .nullable(),
});

export const runStepInput = z.object({
  kind: z.enum(["tool", "text", "result"]),
  name: z.string().optional().nullable(),
  target: z.string().optional().nullable(),
  argument: z.string().optional().nullable(),
  resultBytes: z.number().int().nonnegative().optional().nullable(),
  isError: z.boolean().optional(),
  text: z.string().optional().nullable(),
  at: z.string().optional().nullable(),
});

export const recordRunInput = z.object({
  reviewId: z.string().min(1).optional().nullable(),
  contentVersion: z.number().int().positive().optional().nullable(),
  outcome: z.enum(["published", "authored_only", "failed"]),
  repo: z.string().min(1),
  branch: z.string().min(1),
  headSha: z.string().optional().nullable(),
  prNumber: z.number().int().positive().optional().nullable(),
  trigger: z.enum(["ci", "local", "unknown"]).default("unknown"),
  model: z.string().optional().nullable(),
  promptPath: z.string().optional().nullable(),
  promptSha256: z.string().optional().nullable(),
  toolVersion: z.string().optional().nullable(),
  agentVersion: z.string().optional().nullable(),
  agentSessionRef: z.string().optional().nullable(),
  hostname: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
  costUsdMicros: z.number().int().nonnegative().optional().nullable(),
  inputTokens: z.number().int().nonnegative().optional().nullable(),
  outputTokens: z.number().int().nonnegative().optional().nullable(),
  turns: z.number().int().nonnegative().optional().nullable(),
  inputs: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  finalMessage: z.string().optional().nullable(),
  transcriptAttachmentId: z.string().optional().nullable(),
  steps: z.array(runStepInput).default([]),
});

export const listRunsInput = z.object({
  repo: z.string().min(1).optional().nullable(),
  branch: z.string().min(1).optional().nullable(),
  reviewId: z.string().min(1).optional().nullable(),
  outcome: z
    .enum(["published", "authored_only", "failed"])
    .optional()
    .nullable(),
  trigger: z.enum(["ci", "local", "unknown"]).optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).optional().nullable(),
});
