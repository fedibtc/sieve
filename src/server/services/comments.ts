import { and, asc, count, eq, gte, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { comments, reviews, user } from "@/server/db/schema";
import { getAnchorLabel, type ReviewAnchor } from "@/shared/anchors";
import { anchoredCommentInputSchema } from "@/shared/blocks";
import { listReviewEvents, recordEvent } from "./events";

export type CommentThread = {
  root: typeof comments.$inferSelect & {
    authorName: string | null;
    authorEmail: string | null;
    detached: boolean;
    anchorLabel: string;
    anchorContext: string;
  };
  replies: Array<
    typeof comments.$inferSelect & {
      authorName: string | null;
      authorEmail: string | null;
      detached: boolean;
      anchorLabel: string;
      anchorContext: string;
    }
  >;
};

type ThreadComment = CommentThread["root"];

type FeedbackThread = CommentThread & {
  newMessages: ThreadComment[];
  newMessageIds: string[];
};

export async function listCommentThreads(reviewId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      comment: comments,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(comments)
    .leftJoin(user, eq(comments.authorUserId, user.id))
    .where(eq(comments.reviewId, reviewId))
    .orderBy(asc(comments.createdAt));

  const [review] = await db
    .select({ content: reviews.content })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  const content = review?.content;

  const byRoot = new Map<string, CommentThread>();
  for (const row of rows) {
    const comment = {
      ...row.comment,
      authorName: row.authorName,
      authorEmail: row.authorEmail,
      detached: isDetached(row.comment.anchor as ReviewAnchor | null, content),
      anchorLabel: getContentAnchorLabel(
        row.comment.anchor as ReviewAnchor | null,
        content,
      ),
      anchorContext: getContentAnchorLabel(
        row.comment.anchor as ReviewAnchor | null,
        content,
      ),
    };
    const rootId = row.comment.parentCommentId ?? row.comment.id;
    const thread = byRoot.get(rootId) ?? { root: comment, replies: [] };
    if (row.comment.parentCommentId) {
      thread.replies.push(comment);
    } else {
      thread.root = comment;
    }
    byRoot.set(rootId, thread);
  }

  return Array.from(byRoot.values());
}

export async function createComment(input: {
  reviewId: string;
  authorUserId: string;
  createdBy: "human" | "agent";
  message: string;
  anchor?: ReviewAnchor | null;
  resolutionTarget?: "agent" | "human";
  parentCommentId?: string | null;
}) {
  const parsed = anchoredCommentInputSchema.parse({
    message: input.message,
    anchor: input.anchor ?? null,
    resolutionTarget: input.resolutionTarget ?? "agent",
  });
  const db = await getDb();
  const [review] = await db
    .select({ contentVersion: reviews.contentVersion })
    .from(reviews)
    .where(eq(reviews.id, input.reviewId))
    .limit(1);
  if (!review) {
    throw new Error("Review not found");
  }
  if (input.parentCommentId) {
    const [parent] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(
        and(
          eq(comments.id, input.parentCommentId),
          eq(comments.reviewId, input.reviewId),
          isNull(comments.parentCommentId),
        ),
      )
      .limit(1);
    if (!parent) {
      throw new Error("Parent comment not found");
    }
  }
  const windowStart = new Date(Date.now() - 60_000);
  const [recent] = await db
    .select({ value: count(comments.id) })
    .from(comments)
    .where(
      and(
        eq(comments.reviewId, input.reviewId),
        eq(comments.authorUserId, input.authorUserId),
        gte(comments.createdAt, windowStart),
      ),
    );
  if (Number(recent?.value ?? 0) >= 30) {
    throw new Error("Comment rate limit exceeded");
  }

  const [created] = await db
    .insert(comments)
    .values({
      reviewId: input.reviewId,
      parentCommentId: input.parentCommentId ?? null,
      message: parsed.message,
      anchor: parsed.anchor,
      createdBy: input.createdBy,
      authorUserId: input.authorUserId,
      resolutionTarget: parsed.resolutionTarget,
      contentVersionAtCreate: review.contentVersion,
    })
    .returning();

  await recordEvent({
    reviewId: input.reviewId,
    type: "comment.created",
    message: "Comment created",
    payload: {
      commentId: created.id,
      resolutionTarget: created.resolutionTarget,
    },
    createdBy: input.createdBy,
    actorUserId: input.authorUserId,
  });

  return created;
}

export async function resolveComment(input: {
  reviewId: string;
  commentId: string;
  actorUserId: string;
  actor?: "human" | "agent";
  resolved: boolean;
  replyMessage?: string | null;
}) {
  const db = await getDb();
  if (input.replyMessage?.trim()) {
    await createComment({
      reviewId: input.reviewId,
      authorUserId: input.actorUserId,
      createdBy: input.actor ?? "human",
      message: input.replyMessage.trim(),
      parentCommentId: input.commentId,
      resolutionTarget: "agent",
    });
  }

  const values = input.resolved
    ? {
        status: "resolved" as const,
        resolvedByUserId: input.actorUserId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      }
    : {
        status: "open" as const,
        resolvedByUserId: null,
        resolvedAt: null,
        updatedAt: new Date(),
      };

  const [updated] = await db
    .update(comments)
    .set(values)
    .where(
      and(
        eq(comments.id, input.commentId),
        eq(comments.reviewId, input.reviewId),
      ),
    )
    .returning();
  if (!updated) {
    throw new Error("Comment not found");
  }

  await recordEvent({
    reviewId: input.reviewId,
    type: "comment.resolved",
    message: input.resolved ? "Comment resolved" : "Comment reopened",
    payload: { commentId: input.commentId },
    createdBy: input.actor ?? "human",
    actorUserId: input.actorUserId,
  });
  return updated;
}

export async function getFeedbackPartition(reviewId: string) {
  const db = await getDb();
  const [review] = await db
    .select({ status: reviews.status })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  const threads = await listCommentThreads(reviewId);
  const unread = threads
    .map((thread) => withUnreadHumanMessages(thread))
    .filter((thread) => thread.newMessages.length > 0);
  const detachedThreads = unread.filter((thread) =>
    thread.newMessages.some((comment) => comment.detached),
  );
  const attachedUnread = unread.filter(
    (thread) =>
      !detachedThreads.some((detached) => detached.root.id === thread.root.id),
  );
  const actionableThreads = attachedUnread.filter((thread) =>
    thread.newMessages.some(
      (comment) =>
        comment.status === "open" && comment.resolutionTarget === "agent",
    ),
  );
  const fyiThreads = attachedUnread.filter(
    (thread) =>
      !actionableThreads.some(
        (actionable) => actionable.root.id === thread.root.id,
      ) &&
      thread.newMessages.some(
        (comment) =>
          comment.status === "open" && comment.resolutionTarget === "human",
      ),
  );
  const resolvedThreads = attachedUnread.filter(
    (thread) =>
      !actionableThreads.some(
        (actionable) => actionable.root.id === thread.root.id,
      ) &&
      !fyiThreads.some((fyi) => fyi.root.id === thread.root.id) &&
      thread.newMessages.some((comment) => comment.status === "resolved"),
  );
  const recentReviewEvents = (await listReviewEvents(reviewId))
    .filter((event) => event.createdBy === "human")
    .slice(0, 10);
  const targets = groupFeedbackTargets({
    actionableThreads,
    detachedThreads,
    fyiThreads,
    resolvedThreads,
  });

  return {
    reviewStatus: review?.status ?? null,
    targets,
    recentReviewEvents,
    actionableThreads,
    fyiThreads,
    detachedThreads,
    resolvedThreads,
    commentIds: unread.flatMap((thread) => thread.newMessageIds),
    feedbackSummary: [
      `${actionableThreads.length} actionable agent-targeted thread(s)`,
      `${fyiThreads.length} FYI human-targeted thread(s)`,
      `${detachedThreads.length} detached thread(s)`,
    ].join("; "),
    instructions: [
      ...(review?.status === "changes_requested"
        ? [
            "Review status is changes_requested: the human pass is complete; fix actionables and republish to return the review to open.",
          ]
        : []),
      "Act only on actionableThreads; resolutionTarget is the routing signal.",
      "Do not resolve human-targeted FYI threads; consume them after reading.",
      "For each fixed actionable thread, validate the repo, republish the same review, reply, resolve, then consume feedback.",
      "Reconcile detached threads manually; do not silently drop them.",
    ],
  };
}

export async function consumeFeedback(
  reviewId: string,
  actorUserId: string,
  commentIds?: string[],
) {
  const db = await getDb();
  const now = new Date();
  const clauses = [
    eq(comments.reviewId, reviewId),
    eq(comments.createdBy, "human" as const),
    isNull(comments.consumedAt),
  ];
  if (commentIds) {
    if (commentIds.length === 0) {
      return [];
    }
    clauses.push(inArray(comments.id, commentIds));
  }
  const updated = await db
    .update(comments)
    .set({ consumedAt: now, updatedAt: now })
    .where(and(...clauses))
    .returning();

  await recordEvent({
    reviewId,
    type: "feedback.consumed",
    message: "Feedback consumed",
    payload: { count: updated.length },
    createdBy: "agent",
    actorUserId,
  });

  return updated;
}

function groupFeedbackTargets(groups: {
  actionableThreads: FeedbackThread[];
  fyiThreads: FeedbackThread[];
  detachedThreads: FeedbackThread[];
  resolvedThreads: FeedbackThread[];
}) {
  const targetMap = new Map<
    string,
    {
      anchor: ReviewAnchor | null;
      anchorContext: string;
      commentIds: string[];
      counts: {
        actionable: number;
        detached: number;
        fyi: number;
        resolved: number;
      };
      label: string;
      threadIds: string[];
      threads: FeedbackThread[];
    }
  >();
  const orderedGroups = [
    ["actionable", groups.actionableThreads],
    ["detached", groups.detachedThreads],
    ["fyi", groups.fyiThreads],
    ["resolved", groups.resolvedThreads],
  ] as const;

  for (const [kind, threads] of orderedGroups) {
    for (const thread of threads) {
      const key = feedbackTargetKey(thread.root);
      const target = targetMap.get(key) ?? {
        anchor: thread.root.anchor as ReviewAnchor | null,
        anchorContext: thread.root.anchorContext,
        commentIds: [],
        counts: {
          actionable: 0,
          detached: 0,
          fyi: 0,
          resolved: 0,
        },
        label: thread.root.anchorLabel,
        threadIds: [],
        threads: [],
      };
      target.counts[kind] += 1;
      target.threadIds.push(thread.root.id);
      target.commentIds.push(...thread.newMessageIds);
      target.threads.push(thread);
      targetMap.set(key, target);
    }
  }

  return Array.from(targetMap.values());
}

function feedbackTargetKey(comment: ThreadComment) {
  const anchor = comment.anchor as ReviewAnchor | null;
  if (!anchor) {
    return "review";
  }
  if (anchor.kind === "line" && anchor.line) {
    return [
      "line",
      anchor.blockId,
      anchor.filePath ?? "",
      anchor.line.side,
      anchor.line.start,
      anchor.line.end ?? anchor.line.start,
    ].join(":");
  }
  if (anchor.kind === "file" && anchor.filePath) {
    return ["file", anchor.filePath].join(":");
  }
  if (anchor.kind === "question" && anchor.questionId) {
    return ["question", anchor.blockId, anchor.questionId].join(":");
  }
  if (anchor.textQuote?.quote) {
    return [
      "text",
      anchor.blockId,
      normalizeComparableText(anchor.textQuote.quote),
    ].join(":");
  }
  return ["block", anchor.blockId].join(":");
}

function withUnreadHumanMessages(thread: CommentThread): FeedbackThread {
  const newMessages = [thread.root, ...thread.replies].filter(
    (comment) => comment.createdBy === "human" && !comment.consumedAt,
  );
  return {
    ...thread,
    newMessages,
    newMessageIds: newMessages.map((comment) => comment.id),
  };
}

function isDetached(anchor: ReviewAnchor | null, content: unknown) {
  if (!anchor || typeof content !== "object" || content === null) {
    return false;
  }

  const document = content as {
    blocks?: Array<{ id: string; data?: unknown }>;
  };
  const block = document.blocks?.find((item) => item.id === anchor.blockId);
  if (!block) {
    return true;
  }

  if (!anchor.textQuote?.quote) {
    return false;
  }

  const quote = normalizeComparableText(anchor.textQuote.quote);
  return !extractStrings(block.data ?? {}).some((value) =>
    normalizeComparableText(value).includes(quote),
  );
}

function extractStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(extractStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(extractStrings);
  }
  return [];
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getContentAnchorLabel(anchor: ReviewAnchor | null, content: unknown) {
  if (
    anchor?.kind === "block" &&
    typeof content === "object" &&
    content !== null
  ) {
    const document = content as {
      blocks?: Array<{
        id: string;
        type?: string;
        data?: { name?: unknown; status?: unknown };
      }>;
    };
    const block = document.blocks?.find((item) => item.id === anchor.blockId);
    if (block?.type === "image-diff" && typeof block.data?.name === "string") {
      const status =
        typeof block.data.status === "string" ? ` (${block.data.status})` : "";
      return `image-diff "${block.data.name}"${status}`;
    }
  }

  return getAnchorLabel(anchor);
}
