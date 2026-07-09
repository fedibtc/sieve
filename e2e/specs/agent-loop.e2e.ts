import {
  addBrowserComment,
  agentConsume,
  agentReply,
  agentResolve,
  basicBlocks,
  getFeedback,
  publishFixtureReview,
} from "../helpers/api";
import { expect, test } from "../helpers/fixtures";

test("full publish to feedback to republish to approval loop", async ({
  page,
  request,
}) => {
  const key = `e2e-loop-${Date.now()}`;
  const published = await publishFixtureReview(request, {
    title: "Full loop fixture",
    idempotencyKey: key,
    blocks: basicBlocks(),
  });
  await page.goto(`/reviews/${published.review.id}`);

  await addBrowserComment(request, published.review.id, {
    message: "Please fix this line",
    anchor: {
      blockId: "fixture-diff",
      kind: "line",
      filePath: "src/example.ts",
      line: { side: "after", start: 1 },
    },
    resolutionTarget: "agent",
  });
  await page.reload();
  await expect(page.getByText("Please fix this line")).toBeVisible();

  const feedback = await getFeedback(request, published.review.id);
  expect(JSON.stringify(feedback)).toContain("Please fix this line");
  const commentId = feedback.commentIds[0];

  await agentReply(request, published.review.id, commentId, "Fixed in v2");
  await expect(page.getByText("Fixed in v2")).toBeVisible({ timeout: 15_000 });

  await agentResolve(request, published.review.id, commentId);
  await expect(page.getByText("Resolved")).toBeVisible({ timeout: 15_000 });

  await agentConsume(request, published.review.id, [commentId]);
  await expect(page.getByTitle("Agent has not pulled this yet")).toHaveCount(
    0,
    {
      timeout: 15_000,
    },
  );

  await page.getByRole("button", { name: "Request changes" }).click();
  const changedFeedback = await getFeedback(request, published.review.id);
  expect(changedFeedback.reviewStatus).toBe("changes_requested");

  await publishFixtureReview(request, {
    title: "Full loop fixture",
    idempotencyKey: key,
    blocks: [basicBlocks()[0]],
  });
  await page.reload();
  await expect(page.getByText(/v2/)).toBeVisible();
  await expect(page.getByText("Fixture diff")).toHaveCount(0);

  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Approved")).toBeVisible();
});
