import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/server/db/client";
import { credentialAppSeedReview } from "@/shared/fixtures";
import { createPatchAttachment, createPngAttachment } from "./attachments";
import { createComment } from "./comments";
import { listReviews, updateReviewStatus, upsertReview } from "./reviews";
import { ensureUser } from "./users";

describe("review service", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://reviews-${crypto.randomUUID()}`;
    resetDbForTests();
  });

  it("upserts by idempotency key and snapshots versions", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const first = await upsertReview({
      origin: "derived",
      title: "First",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: credentialAppSeedReview,
      idempotencyKey: "same-key",
      createdByUserId: user.id,
    });
    const second = await upsertReview({
      origin: "derived",
      title: "Second",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: credentialAppSeedReview,
      idempotencyKey: "same-key",
      createdByUserId: user.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.contentVersion).toBe(2);
    expect(second.title).toBe("Second");
  });

  it("enforces human-only approval and changes requests", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const review = await upsertReview({
      origin: "derived",
      title: "Approval check",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: credentialAppSeedReview,
      idempotencyKey: "approval-key",
      createdByUserId: user.id,
    });

    await expect(
      updateReviewStatus({
        reviewId: review.id,
        status: "approved",
        actorUserId: user.id,
        actor: "agent",
      }),
    ).rejects.toThrow(/Only humans/);

    await expect(
      updateReviewStatus({
        reviewId: review.id,
        status: "approved",
        actorUserId: user.id,
        actor: "human",
      }),
    ).resolves.toMatchObject({ status: "approved" });

    await expect(
      updateReviewStatus({
        reviewId: review.id,
        status: "changes_requested",
        actorUserId: user.id,
        actor: "agent",
      }),
    ).rejects.toThrow(/Only humans/);

    await expect(
      updateReviewStatus({
        reviewId: review.id,
        status: "changes_requested",
        actorUserId: user.id,
        actor: "human",
      }),
    ).resolves.toMatchObject({ status: "changes_requested" });
  });

  it("reopens republished reviews and infers the PR number", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const review = await upsertReview({
      origin: "derived",
      title: "PR check",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      prUrl: "https://github.com/fedibtc/credential-app/pull/92",
      content: credentialAppSeedReview,
      idempotencyKey: "pr-key",
      createdByUserId: user.id,
    });
    await updateReviewStatus({
      reviewId: review.id,
      status: "approved",
      actorUserId: user.id,
      actor: "human",
    });

    const updated = await upsertReview({
      origin: "derived",
      title: "PR check v2",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      prUrl: "https://github.com/fedibtc/credential-app/pull/92",
      content: credentialAppSeedReview,
      idempotencyKey: "pr-key",
      createdByUserId: user.id,
    });

    expect(updated.status).toBe("open");
    expect(updated.prNumber).toBe(92);
  });

  it("counts only open root comments targeted at the agent", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const review = await upsertReview({
      origin: "derived",
      title: "Comment count",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: credentialAppSeedReview,
      idempotencyKey: "count-key",
      createdByUserId: user.id,
    });
    const openAgent = await createComment({
      reviewId: review.id,
      authorUserId: user.id,
      createdBy: "human",
      message: "Fix this",
      resolutionTarget: "agent",
    });
    await createComment({
      reviewId: review.id,
      authorUserId: user.id,
      createdBy: "human",
      message: "FYI",
      resolutionTarget: "human",
    });
    await createComment({
      reviewId: review.id,
      authorUserId: user.id,
      createdBy: "human",
      message: "Reply",
      parentCommentId: openAgent.id,
      resolutionTarget: "agent",
    });

    const [listed] = await listReviews();
    expect(listed?.openComments).toBe(1);
  });

  it("rejects image-diff blocks with dangling attachment ids", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    await expect(
      upsertReview({
        origin: "derived",
        title: "Dangling visual",
        repo: "fedibtc/credential-app",
        branch: "codex/test",
        content: imageDiffDocument({
          before: "missing-before",
          after: "missing-after",
          diff: "missing-diff",
        }),
        idempotencyKey: "dangling-visual-key",
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/Unknown attachmentId/);
  });

  it("validates file-tree patch refs against stored attachments", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    await expect(
      upsertReview({
        origin: "derived",
        title: "Dangling patch",
        repo: "fedibtc/credential-app",
        branch: "codex/test",
        content: fileTreePatchDocument("missing-patch"),
        idempotencyKey: "dangling-patch-key",
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/Unknown attachmentId/);

    const patch = await createPatchAttachment({
      data: Buffer.from("--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n"),
      createdByUserId: user.id,
    });
    const review = await upsertReview({
      origin: "derived",
      title: "Stored patch",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: fileTreePatchDocument(patch.attachment.id),
      idempotencyKey: "stored-patch-key",
      createdByUserId: user.id,
    });
    expect(review.id).toBeTruthy();
  });

  it("accepts image-diff blocks with stored attachment ids", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });
    const before = await createPngAttachment({
      data: tinyPng(0x11),
      createdByUserId: user.id,
    });
    const after = await createPngAttachment({
      data: tinyPng(0x22),
      createdByUserId: user.id,
    });
    const diff = await createPngAttachment({
      data: tinyPng(0x33),
      createdByUserId: user.id,
    });

    const review = await upsertReview({
      origin: "derived",
      title: "Stored visual",
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      content: imageDiffDocument({
        before: before.attachment.id,
        after: after.attachment.id,
        diff: diff.attachment.id,
      }),
      idempotencyKey: "stored-visual-key",
      createdByUserId: user.id,
    });

    expect(review.title).toBe("Stored visual");
  });

  it("rejects an authored publish without a claim", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    await expect(
      upsertReview({
        origin: "authored",
        title: "Claimless",
        repo: "fedibtc/credential-app",
        branch: "codex/test",
        content: credentialAppSeedReview,
        idempotencyKey: "claimless-key",
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/summary claim/);

    await expect(
      upsertReview({
        origin: "authored",
        title: "Claimless",
        summary: "   ",
        repo: "fedibtc/credential-app",
        branch: "codex/test",
        content: credentialAppSeedReview,
        idempotencyKey: "claimless-key",
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/summary claim/);
  });

  it("rejects an authored claim that just repeats the title", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    await expect(
      upsertReview({
        origin: "authored",
        title: "Harden the QR flow",
        summary: "  harden the qr flow ",
        repo: "fedibtc/credential-app",
        branch: "codex/test",
        content: credentialAppSeedReview,
        idempotencyKey: "title-echo-key",
        createdByUserId: user.id,
      }),
    ).rejects.toThrow(/more than the title/);
  });

  it("accepts an authored publish with a real claim, and a derived one without", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    const authored = await upsertReview({
      origin: "authored",
      title: "Harden the QR flow",
      summary:
        "Retries no longer drop the shared offer; covered by property tests.",
      repo: "fedibtc/credential-app",
      branch: "codex/authored",
      content: credentialAppSeedReview,
      idempotencyKey: "authored-claim-key",
      createdByUserId: user.id,
    });
    expect(authored.origin).toBe("authored");

    const derived = await upsertReview({
      origin: "derived",
      title: "PR #1: mechanical recap",
      repo: "fedibtc/credential-app",
      branch: "codex/derived",
      content: credentialAppSeedReview,
      idempotencyKey: "derived-no-claim-key",
      createdByUserId: user.id,
    });
    expect(derived.origin).toBe("derived");
    expect(derived.summary).toBeNull();
  });
});

function imageDiffDocument(ids: {
  before: string;
  after: string;
  diff: string;
}) {
  return {
    version: 1 as const,
    blocks: [
      {
        id: "visual-login",
        type: "image-diff" as const,
        data: {
          name: "login screen",
          status: "changed" as const,
          before: { attachmentId: ids.before, width: 1, height: 1 },
          after: { attachmentId: ids.after, width: 1, height: 1 },
          diff: { attachmentId: ids.diff, width: 1, height: 1 },
        },
      },
    ],
  };
}

function fileTreePatchDocument(attachmentId: string) {
  return {
    version: 1 as const,
    blocks: [
      {
        id: "files",
        type: "file-tree" as const,
        data: {
          entries: [
            {
              path: "src/x.ts",
              change: "modified" as const,
              additions: 1,
              deletions: 1,
              patch: { attachmentId, lines: 5 },
            },
          ],
        },
      },
    ],
  };
}

function tinyPng(color: number) {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  png[png.length - 12] = color;
  return png;
}
