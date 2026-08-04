import { createHash } from "node:crypto";
import {
  allBlockTypes,
  maliciousMermaid,
  publishFixtureReview,
  uploadAttachment,
  uploadPatch,
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

  await expect(page.getByText("Where the change lands")).toBeVisible();
  const shapeBlock = page.locator("article", {
    hasText: "Where the change lands",
  });
  await expect(shapeBlock.getByText("src/app", { exact: true })).toBeVisible();
  await expect(shapeBlock.getByText("2 files")).toBeVisible();
  await expect(shapeBlock.getByText("+180")).toBeVisible();
  await expect(shapeBlock.getByText("-50")).toBeVisible();

  await page.getByRole("button", { name: /src\/a\.ts/ }).click();
  await expect(page.getByTitle("Clear anchor")).toContainText("src/a.ts");

  const endpoint = page.getByRole("button", { name: /POST \/api\/e2e/ });
  await endpoint.scrollIntoViewIfNeeded();
  await expectHittable(endpoint);
  await endpoint.click();
  await expect(page.getByText(/Review id/)).toBeVisible();
  await endpoint.click();
  await expect(page.getByText(/Review id/)).toHaveCount(0);

  // The code and diff blocks form an evidence set, collapsed by default.
  await page.getByRole("button", { name: "Expand all" }).click();
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

test("file-tree entries expand their full patch in place", async ({
  page,
  request,
}) => {
  const attachment = await uploadPatch(request);
  const published = await publishFixtureReview(request, {
    title: "Full patch expansion",
    blocks: [
      {
        id: "files",
        type: "file-tree",
        summary: "Changed files",
        data: {
          entries: [
            {
              path: "src/full.ts",
              change: "modified",
              additions: 1,
              deletions: 1,
              patch: { attachmentId: attachment.id, lines: 8 },
            },
            { path: "src/plain.ts", change: "added", additions: 2 },
          ],
        },
      },
    ],
  });
  await page.goto(`/reviews/${published.review.id}`);

  await expect(page.getByText("fullPatchMarker")).toHaveCount(0);
  const toggle = page.getByRole("button", { name: /8 lines/ });
  await toggle.click();
  await expect(
    page.getByText("+export const fullPatchMarker = 2;"),
  ).toBeVisible();
  await expect(
    page.getByText("-export const fullPatchMarker = 1;"),
  ).toBeVisible();
  await toggle.click();
  await expect(page.getByText("fullPatchMarker")).toHaveCount(0);
});

test("seeded image diff and mermaid interactions work", async ({ page }) => {
  await page.goto("/reviews/seed-credential-app-qr");
  const visualBlock = page.locator("article#visual-diff-credential-acceptance");
  await expect(visualBlock.getByText("credential-acceptance")).toBeVisible();
  // Before, after, and diff share one row.
  const visualGeometry = await visualBlock.evaluate((element) => {
    const container = element.querySelector("[data-visual-primary]");
    const before = element.querySelector('[data-visual-panel="before"]');
    const after = element.querySelector('[data-visual-panel="after"]');
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
      differenceWidth: differenceRect.width,
      beforeTop: beforeRect.top,
      afterTop: afterRect.top,
      differenceTop: differenceRect.top,
    };
  });
  expect(visualGeometry).not.toBeNull();
  expect(visualGeometry?.beforeWidth).toBeGreaterThan(
    (visualGeometry?.containerWidth ?? 0) * 0.25,
  );
  expect(visualGeometry?.differenceWidth).toBeLessThan(
    (visualGeometry?.containerWidth ?? 0) * 0.45,
  );
  expect(visualGeometry?.afterTop).toBe(visualGeometry?.beforeTop);
  expect(visualGeometry?.differenceTop).toBe(visualGeometry?.beforeTop);
  const thumbnail = page.getByRole("img", {
    name: /credential-acceptance after/i,
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
