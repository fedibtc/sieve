import { and, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { comments, reviews, reviewVersions } from "@/server/db/schema";
import {
  collectAttachmentIds,
  type ReviewDocument,
  reviewDocumentSchema,
} from "@/shared/blocks";
import { findMissingAttachmentIds } from "./attachments";
import { recordEvent } from "./events";

export async function listReviews(filters?: {
  repo?: string | null;
  status?: "open" | "approved" | "changes_requested" | "archived" | null;
}) {
  const db = await getDb();
  const where = and(
    filters?.repo ? ilike(reviews.repo, `%${filters.repo}%`) : undefined,
    filters?.status ? eq(reviews.status, filters.status) : undefined,
  );
  const rows = await db
    .select({
      review: reviews,
      openComments: count(comments.id),
    })
    .from(reviews)
    .leftJoin(
      comments,
      and(
        eq(comments.reviewId, reviews.id),
        isNull(comments.parentCommentId),
        eq(comments.status, "open"),
        eq(comments.resolutionTarget, "agent"),
      ),
    )
    .where(where)
    .groupBy(reviews.id)
    .orderBy(desc(reviews.updatedAt));

  return rows.map((row) => ({
    ...row.review,
    openComments: Number(row.openComments),
  }));
}

export async function getReview(reviewId: string) {
  const db = await getDb();
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  return review ?? null;
}

export async function upsertReview(input: {
  id?: string;
  title: string;
  summary?: string | null;
  repo: string;
  branch: string;
  baseRef?: string | null;
  headSha?: string | null;
  prNumber?: number | null;
  prUrl?: string | null;
  content: ReviewDocument;
  idempotencyKey: string;
  createdByUserId: string;
  agentName?: string | null;
  changeNote?: string | null;
}) {
  const content = reviewDocumentSchema.parse(input.content);
  await assertAttachmentsExist(content);
  const prNumber = input.prNumber ?? inferPrNumber(input.prUrl) ?? null;
  const db = await getDb();
  const existing = await db
    .select()
    .from(reviews)
    .where(eq(reviews.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing[0]) {
    const nextVersion = existing[0].contentVersion + 1;
    const [updated] = await db
      .update(reviews)
      .set({
        title: input.title,
        summary: input.summary ?? null,
        repo: input.repo,
        branch: input.branch,
        baseRef: input.baseRef ?? null,
        headSha: input.headSha ?? null,
        prNumber,
        prUrl: input.prUrl ?? null,
        status: "open",
        content,
        contentVersion: nextVersion,
        agentName: input.agentName ?? null,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, existing[0].id))
      .returning();
    await db.insert(reviewVersions).values({
      reviewId: updated.id,
      version: nextVersion,
      content,
      changeNote: input.changeNote ?? "Review updated",
      createdBy: "agent",
    });
    await recordEvent({
      reviewId: updated.id,
      type: "review.updated",
      message: "Review updated",
      payload: { version: nextVersion },
      createdBy: "agent",
      actorUserId: input.createdByUserId,
    });
    return updated;
  }

  const [created] = await db
    .insert(reviews)
    .values({
      id: input.id,
      title: input.title,
      summary: input.summary ?? null,
      repo: input.repo,
      branch: input.branch,
      baseRef: input.baseRef ?? null,
      headSha: input.headSha ?? null,
      prNumber,
      prUrl: input.prUrl ?? null,
      content,
      idempotencyKey: input.idempotencyKey,
      createdByUserId: input.createdByUserId,
      agentName: input.agentName ?? null,
    })
    .returning();
  await db.insert(reviewVersions).values({
    reviewId: created.id,
    version: 1,
    content,
    changeNote: input.changeNote ?? "Initial publish",
    createdBy: "agent",
  });
  await recordEvent({
    reviewId: created.id,
    type: "review.published",
    message: "Review published",
    payload: { version: 1 },
    createdBy: "agent",
    actorUserId: input.createdByUserId,
  });
  return created;
}

async function assertAttachmentsExist(content: ReviewDocument) {
  const missing = await findMissingAttachmentIds(collectAttachmentIds(content));
  if (missing.length > 0) {
    throw new Error(`Unknown attachmentId(s): ${missing.join(", ")}`);
  }
}

function inferPrNumber(prUrl?: string | null) {
  if (!prUrl) {
    return null;
  }
  const match = /github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/.exec(prUrl);
  return match ? Number(match[1]) : null;
}

export async function updateReviewStatus(input: {
  reviewId: string;
  status: "open" | "approved" | "changes_requested" | "archived";
  actorUserId: string;
  actor: "human" | "agent";
}) {
  if (input.status === "approved" && input.actor !== "human") {
    throw new Error("Only humans can approve reviews");
  }
  if (input.status === "changes_requested" && input.actor !== "human") {
    throw new Error("Only humans can request changes");
  }

  const db = await getDb();
  const [updated] = await db
    .update(reviews)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(reviews.id, input.reviewId))
    .returning();
  if (!updated) {
    throw new Error("Review not found");
  }

  await recordEvent({
    reviewId: input.reviewId,
    type: "review.status_changed",
    message: `Review marked ${input.status}`,
    payload: { status: input.status },
    createdBy: input.actor,
    actorUserId: input.actorUserId,
  });
  return updated;
}
