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
