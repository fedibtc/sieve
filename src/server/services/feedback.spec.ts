import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/server/db/client";
import { credentialAppSeedReview } from "@/shared/fixtures";
import {
  consumeFeedback,
  createComment,
  getFeedbackPartition,
  listCommentThreads,
  resolveComment,
} from "./comments";
import { updateReviewStatus, upsertReview } from "./reviews";
import { ensureUser } from "./users";

describe("feedback partitioning", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://feedback-${crypto.randomUUID()}`;
    resetDbForTests();
  });

  it("splits actionable, human FYI, detached, and consumed threads", async () => {
    const agent = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const human = await ensureUser({
      id: "human",
      name: "Human",
      email: "human@localhost",
      emailVerified: true,
    });
    const review = await upsertReview({
      title: "Feedback check",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: credentialAppSeedReview,
      idempotencyKey: "feedback-key",
      createdByUserId: agent.id,
    });

    await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Agent fix",
      anchor: { blockId: "issuer-flow-diff", kind: "block" },
      resolutionTarget: "agent",
    });
    await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Human FYI",
      anchor: { blockId: "review-questions", kind: "block" },
      resolutionTarget: "human",
    });
    await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Detached",
      anchor: { blockId: "missing-block", kind: "block" },
      resolutionTarget: "agent",
    });

    const partition = await getFeedbackPartition(review.id);
    expect(partition.reviewStatus).toBe("open");
    expect(partition.actionableThreads).toHaveLength(1);
    expect(partition.fyiThreads).toHaveLength(1);
    expect(partition.detachedThreads).toHaveLength(1);
    expect(partition.targets).toHaveLength(3);
    expect(partition.targets[0]).toMatchObject({
      label: "issuer-flow-diff",
      anchorContext: "issuer-flow-diff",
      counts: { actionable: 1, detached: 0, fyi: 0, resolved: 0 },
    });
    expect(partition.recentReviewEvents).toHaveLength(3);
    expect(partition.actionableThreads[0]?.root.anchorContext).toBe(
      "issuer-flow-diff",
    );
    expect(partition.commentIds).toHaveLength(3);
    expect(partition.feedbackSummary).toContain("1 actionable");
    expect(partition.instructions).toContain(
      "Act only on actionableThreads; resolutionTarget is the routing signal.",
    );

    await updateReviewStatus({
      reviewId: review.id,
      status: "changes_requested",
      actorUserId: human.id,
      actor: "human",
    });
    const changesRequestedPartition = await getFeedbackPartition(review.id);
    expect(changesRequestedPartition.reviewStatus).toBe("changes_requested");
    expect(changesRequestedPartition.instructions[0]).toContain(
      "human pass is complete",
    );

    await consumeFeedback(review.id, agent.id);
    const consumedPartition = await getFeedbackPartition(review.id);
    expect(consumedPartition.actionableThreads).toHaveLength(0);
    expect(consumedPartition.fyiThreads).toHaveLength(0);
    expect(consumedPartition.detachedThreads).toHaveLength(0);
  });

  it("resurfaces a human reply on an already consumed thread", async () => {
    const { agent, human, review } = await setupFeedbackReview();
    const root = await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Please fix the issuer validation.",
      anchor: { blockId: "issuer-flow-diff", kind: "block" },
      resolutionTarget: "agent",
    });

    const firstPartition = await getFeedbackPartition(review.id);
    expect(firstPartition.actionableThreads).toHaveLength(1);
    await consumeFeedback(review.id, agent.id, firstPartition.commentIds);
    await resolveComment({
      reviewId: review.id,
      commentId: root.id,
      actorUserId: agent.id,
      actor: "agent",
      resolved: true,
      replyMessage: "Fixed and validated.",
    });

    await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Still broken on the holder side.",
      parentCommentId: root.id,
      resolutionTarget: "agent",
    });

    const followUpPartition = await getFeedbackPartition(review.id);
    expect(followUpPartition.actionableThreads).toHaveLength(1);
    expect(followUpPartition.actionableThreads[0]?.root.id).toBe(root.id);
    expect(followUpPartition.actionableThreads[0]?.newMessages).toMatchObject([
      { message: "Still broken on the holder side." },
    ]);
    expect(followUpPartition.commentIds).toEqual([
      followUpPartition.actionableThreads[0]?.newMessages[0]?.id,
    ]);
  });

  it("does not hand agent-authored comments back as feedback", async () => {
    const { agent, review } = await setupFeedbackReview();
    await createComment({
      reviewId: review.id,
      authorUserId: agent.id,
      createdBy: "agent",
      message: "Agent note",
      anchor: { blockId: "issuer-flow-diff", kind: "block" },
      resolutionTarget: "agent",
    });

    const partition = await getFeedbackPartition(review.id);
    expect(partition.actionableThreads).toHaveLength(0);
    expect(partition.fyiThreads).toHaveLength(0);
    expect(partition.detachedThreads).toHaveLength(0);
    expect(partition.commentIds).toEqual([]);
  });

  it("keeps consume and resolve as separate axes", async () => {
    const { agent, human, review } = await setupFeedbackReview();
    const first = await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Consume without resolving.",
      anchor: { blockId: "issuer-flow-diff", kind: "block" },
      resolutionTarget: "agent",
    });
    const second = await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Resolve without consuming.",
      anchor: { blockId: "issuer-flow-diff", kind: "block" },
      resolutionTarget: "agent",
    });

    await consumeFeedback(review.id, agent.id, [first.id]);
    await resolveComment({
      reviewId: review.id,
      commentId: second.id,
      actorUserId: agent.id,
      actor: "agent",
      resolved: true,
    });

    const partition = await getFeedbackPartition(review.id);
    expect(partition.actionableThreads).toHaveLength(0);
    expect(partition.resolvedThreads).toHaveLength(1);
    expect(partition.resolvedThreads[0]?.root.id).toBe(second.id);
    expect(partition.commentIds).toEqual([second.id]);
  });

  it("keeps multiline text-quote anchors attached after normalization", async () => {
    const { human, review } = await setupFeedbackReview();
    await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Quote spans lines",
      anchor: {
        blockId: "summary",
        kind: "block",
        textQuote: { quote: "line one\nline two" },
      },
      resolutionTarget: "agent",
    });

    await upsertReview({
      title: "Feedback check",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: {
        version: 1,
        blocks: [
          {
            id: "summary",
            type: "rich-text",
            data: { markdown: "line one\nline two" },
          },
        ],
      },
      idempotencyKey: review.idempotencyKey,
      createdByUserId: review.createdByUserId,
    });

    const [thread] = await listCommentThreads(review.id);
    expect(thread?.root.detached).toBe(false);
  });

  it("detaches text-quote anchors when the quote is removed", async () => {
    const { human, review } = await setupFeedbackReview();
    await createComment({
      reviewId: review.id,
      authorUserId: human.id,
      createdBy: "human",
      message: "Quote removed",
      anchor: {
        blockId: "summary",
        kind: "block",
        textQuote: { quote: "credential issuer flow" },
      },
      resolutionTarget: "agent",
    });

    await upsertReview({
      title: "Feedback check",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: {
        version: 1,
        blocks: [
          {
            id: "summary",
            type: "rich-text",
            data: { markdown: "different content" },
          },
        ],
      },
      idempotencyKey: review.idempotencyKey,
      createdByUserId: review.createdByUserId,
    });

    const [thread] = await listCommentThreads(review.id);
    expect(thread?.root.detached).toBe(true);
  });
});

async function setupFeedbackReview() {
  const agent = await ensureUser({
    id: `agent-${crypto.randomUUID()}`,
    name: "Agent",
    email: `agent-${crypto.randomUUID()}@localhost`,
    emailVerified: true,
  });
  const human = await ensureUser({
    id: `human-${crypto.randomUUID()}`,
    name: "Human",
    email: `human-${crypto.randomUUID()}@localhost`,
    emailVerified: true,
  });
  const review = await upsertReview({
    title: "Feedback check",
    repo: "fedibtc/credential-app",
    branch: "codex/test",
    content: credentialAppSeedReview,
    idempotencyKey: `feedback-key-${crypto.randomUUID()}`,
    createdByUserId: agent.id,
  });

  return { agent, human, review };
}
