import { createHash } from "node:crypto";
import { publishFixtureReview, uploadAttachment } from "../helpers/api";
import { expectHittable, expectRevealedOnHover } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("seeded reviewer journey composes read-only interactions", async ({
  page,
}) => {
  await page.goto("/reviews/seed-credential-app-qr");

  // The seeded review is authored: the header renders the summary claim
  // under the title and names the agent in the origin badge.
  await expect(
    page.getByText(/Seeded M2 recap from credential-app/),
  ).toBeVisible();
  await expect(page.getByText("codex", { exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Outcome" })).toBeVisible();
  await expect(
    page.getByText(/QR\/property coverage, adds Playwright harness checks/),
  ).toBeVisible();
  await expect(
    page.getByText("credential-acceptance", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-visual-panel="before"]')).toBeVisible();
  await expect(page.locator('[data-visual-panel="after"]')).toBeVisible();
  await expect(page.locator('[data-visual-panel="diff"]')).toBeVisible();

  const endpoint = page.getByRole("button", {
    name: /QR: credential-offer payload/,
  });
  await endpoint.scrollIntoViewIfNeeded();
  await expectHittable(endpoint);
  await endpoint.click();
  await expect(page.getByText("roundTrip")).toBeVisible();

  // Evidence cards start collapsed; expanding reveals the unified default.
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "unified" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Authored annotations read inline beside their lines without hovering.
  await expect(
    page.getByText(/Review whether recording the offer before rendering/),
  ).toBeVisible();
  await expect(
    page.locator("article#issuer-flow-diff [data-diff-annotation]"),
  ).toContainText("state coupling");

  const thumbnail = page.getByRole("img", {
    name: /credential-acceptance after/i,
  });
  await thumbnail.scrollIntoViewIfNeeded();
  await expectHittable(thumbnail);
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
  const expandDiagram = diagramBlock.getByRole("button", {
    name: /Expand diagram/i,
  });
  await expectRevealedOnHover(diagramBlock, expandDiagram);
  await expandDiagram.click();
  await expect(
    page.getByRole("button", { name: "Close diagram" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close diagram" }).click();
  await expect(page.getByRole("button", { name: "Close diagram" })).toHaveCount(
    0,
  );

  await page
    .getByRole("button", {
      name: "Comment on src/credential/domain/qrPayloads.property.test.ts",
    })
    .click();
  await expect(page.getByTitle("Clear anchor")).toContainText(
    "qrPayloads.property.test.ts",
  );
});

test("reviewer can open a review that contains recording evidence", async ({
  page,
  request,
}) => {
  const bytes = Buffer.from("reviewer-journey-webm-placeholder");
  const attachment = await uploadAttachment(request, {
    bytes,
    filename: "reviewer-journey.webm",
    mimeType: "video/webm",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  const published = await publishFixtureReview(request, {
    title: "Recorded reviewer journey",
    blocks: [
      {
        id: "recording",
        type: "screen-recording",
        data: {
          attachmentId: attachment.id,
          title: "Reviewer journey",
          caption: "The recording shows the complete change.",
        },
      },
    ],
  });

  await page.goto(`/reviews/${published.review.id}`);
  const recording = page.locator("[data-screen-recording]");
  await expect(recording).toBeVisible();
  await expect(
    recording.getByRole("heading", { name: "Reviewer journey" }),
  ).toBeVisible();
  await expect(recording.getByLabel("Reviewer journey")).toHaveAttribute(
    "controls",
    "",
  );
  await expect(
    recording.getByText("The recording shows the complete change."),
  ).toBeVisible();
});
