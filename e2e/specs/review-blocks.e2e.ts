import { createHash } from "node:crypto";
import {
  allBlockTypes,
  maliciousMermaid,
  publishFixtureReview,
  uploadAttachment,
} from "../helpers/api";
import { expectHittable, expectRevealedOnHover } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("all block types render and key per-block controls have effects", async ({
  page,
  request,
}) => {
  const videoBytes = Buffer.from("e2e-webm-placeholder");
  const recording = await uploadAttachment(request, {
    bytes: videoBytes,
    filename: "reviewer-journey.webm",
    mimeType: "video/webm",
    sha256: createHash("sha256").update(videoBytes).digest("hex"),
  });
  const published = await publishFixtureReview(request, {
    title: "All block types",
    blocks: allBlockTypes(recording.id),
  });
  await page.goto(`/reviews/${published.review.id}`);

  await expect(
    page.getByRole("heading", { name: "All block types" }),
  ).toBeVisible();
  for (const tone of ["info", "decision", "risk", "warning", "success"]) {
    await expect(page.getByText(`A ${tone} callout.`)).toBeVisible();
  }

  await page.getByRole("button", { name: /src\/a\.ts/ }).click();
  await expect(page.getByTitle("Clear anchor")).toContainText("src/a.ts");

  const endpoint = page.getByRole("button", { name: /POST \/api\/e2e/ });
  await endpoint.scrollIntoViewIfNeeded();
  await expectHittable(endpoint);
  await endpoint.click();
  await expect(page.getByText(/Review id/)).toBeVisible();
  await endpoint.click();
  await expect(page.getByText(/Review id/)).toHaveCount(0);

  await page.getByRole("button", { name: /Show all .* lines/ }).click();
  await expect(page.getByText("line36();")).toBeVisible();

  await page.getByRole("button", { name: "yes" }).click();
  const postAnswer = page.getByRole("button", { name: "Post answer" }).first();
  await expect(postAnswer).toBeEnabled();
  await postAnswer.click();
  await expect(page.getByText(/Answered:/)).toBeVisible();
  const video = page.getByLabel("Reviewer journey");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");

  const block = page.locator("article").filter({ hasText: "Markdown" }).first();
  await expectRevealedOnHover(
    block,
    block.getByRole("button", { name: /Comment on block/ }),
  );
});

test("seeded image diff and mermaid interactions work", async ({ page }) => {
  await page.goto("/reviews/seed-credential-app-qr");
  const visualBlock = page.locator("article#visual-diff-credential-acceptance");
  await expect(
    visualBlock.getByRole("heading", { name: "credential-acceptance" }),
  ).toBeVisible();
  await expect(visualBlock.getByText("Visual comparison")).toBeVisible();
  const visualGeometry = await visualBlock.evaluate((element) => {
    const container = element.querySelector("[data-visual-comparison]");
    const before = element.querySelector('[data-visual-panel="merge-base"]');
    const after = element.querySelector('[data-visual-panel="this branch"]');
    const difference = element.querySelector('[data-visual-panel="diff"]');
    if (!container || !before || !after || !difference) {
      return null;
    }
    const containerRect = container.getBoundingClientRect();
    const beforeRect = before.getBoundingClientRect();
    const afterRect = after.getBoundingClientRect();
    const differenceRect = difference.getBoundingClientRect();
    return {
      containerWidth: containerRect.width,
      beforeWidth: beforeRect.width,
      afterWidth: afterRect.width,
      differenceWidth: differenceRect.width,
      comparisonBottom: Math.max(beforeRect.bottom, afterRect.bottom),
      differenceTop: differenceRect.top,
    };
  });
  expect(visualGeometry).not.toBeNull();
  expect(visualGeometry?.beforeWidth).toBeGreaterThan(
    (visualGeometry?.containerWidth ?? 0) * 0.4,
  );
  expect(visualGeometry?.afterWidth).toBeGreaterThan(
    (visualGeometry?.containerWidth ?? 0) * 0.4,
  );
  expect(visualGeometry?.differenceWidth).toBeGreaterThan(
    (visualGeometry?.containerWidth ?? 0) * 0.9,
  );
  expect(visualGeometry?.differenceTop).toBeGreaterThanOrEqual(
    visualGeometry?.comparisonBottom ?? 0,
  );
  const thumbnail = page.getByRole("img", {
    name: /credential-acceptance .*this branch/i,
  });
  await thumbnail.scrollIntoViewIfNeeded();
  await expectHittable(thumbnail);
  await expect(
    thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).resolves.toBeGreaterThan(0);
  await thumbnail.click();
  await expect(
    page.getByRole("button", { name: /close image/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /close image/i }).click();
  await expect(page.getByRole("button", { name: /close image/i })).toHaveCount(
    0,
  );

  const diagramBlock = page.locator("article#flow-diagram");
  await expect(diagramBlock.locator("[role='img'] svg").first()).toBeVisible({
    timeout: 15_000,
  });
  await expectRevealedOnHover(
    diagramBlock,
    diagramBlock.getByRole("button", { name: /Expand diagram/i }),
  );
});

test("malicious mermaid output is sanitized", async ({ page, request }) => {
  const published = await publishFixtureReview(request, {
    title: "Malicious mermaid",
    blocks: maliciousMermaid(),
  });
  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected dialog from mermaid: ${dialog.message()}`);
  });
  await page.goto(`/reviews/${published.review.id}`);
  await page.locator("[role='img'] svg").waitFor({ timeout: 15_000 });
  const html = await page.locator("[role='img']").first().innerHTML();
  expect(html).not.toMatch(/<script|<foreignObject|on\w+=|javascript:/i);
});
