import type { ReviewBlock } from "../../src/shared/blocks";
import { publishFixtureReview } from "../helpers/api";
import { expect, test } from "../helpers/fixtures";

function mergeWithNitsBlocks(): ReviewBlock[] {
  return [
    {
      id: "verdict",
      type: "callout",
      data: {
        tone: "decision",
        markdown:
          "**The spacing change is correct and the findings below are cosmetic.**",
        recommendation: "merge-with-nits",
      },
    },
    {
      id: "key-changes",
      type: "section",
      data: { title: "Key changes" },
    },
    {
      id: "main-diff",
      type: "diff",
      summary: "The gap constant halves and every consumer follows",
      data: {
        filename: "src/composer/spacing.ts",
        before: "const gap = 16;",
        after: "const gap = 8;",
        mode: "unified",
        annotations: [],
      },
    },
    {
      id: "minor-dead-padding",
      type: "diff",
      summary: "The padding edit is dead: the render site overrides it inline",
      severity: "minor",
      data: {
        filename: "src/composer/styles.ts",
        before: "paddingBottom: 8,",
        after: "paddingBottom: 4,",
        mode: "unified",
        annotations: [
          {
            side: "after",
            lines: "1",
            label: "dead code",
            note: "Overridden inline.",
          },
        ],
      },
    },
    {
      id: "minor-scale-drift",
      type: "diff",
      summary: "paddingTop reads as sm scale but tracks xs",
      severity: "minor",
      data: {
        filename: "src/composer/replyBar.ts",
        before: "paddingTop: spacing.sm,",
        after: "paddingTop: spacing.sm - 4,",
        mode: "unified",
        annotations: [],
      },
    },
    {
      id: "appendix",
      type: "rich-text",
      summary: "How the spacing coupling was checked",
      severity: "fyi",
      data: {
        markdown:
          "Both flush-band consumers were traced and retuned in step, so nothing depends on the old value.",
      },
    },
  ];
}

test("a merge-with-nits review folds everything below the verdict", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Severity folds",
    blocks: mergeWithNitsBlocks(),
  });

  await page.goto(`/reviews/${published.review.id}`);
  await expect(
    page.locator('[data-recommendation="merge-with-nits"]'),
  ).toHaveText("Merge with nits");

  // The verdict recommends merging, so even the lone main card starts as a
  // claim line.
  await expect(
    page.getByText("The gap constant halves and every consumer follows"),
  ).toBeVisible();
  await expect(page.getByText("const gap = 8;")).toHaveCount(0);

  const asideGroup = page.locator('[data-evidence-aside="true"]');
  await expect(
    asideGroup.getByRole("heading", { name: "Minor findings (2)" }),
  ).toBeVisible();
  await expect(asideGroup.locator('[data-severity="minor"]')).toHaveCount(2);
  await expect(asideGroup.getByText("minor", { exact: true })).toHaveCount(2);
  await expect(page.getByText("paddingBottom: 4,")).toHaveCount(0);

  await page.getByRole("button", { name: /The padding edit is dead/ }).click();
  await expect(page.getByText("paddingBottom: 4,")).toBeVisible();
  await expect(
    page.locator("article#minor-dead-padding [data-diff-annotation]"),
  ).toContainText("Overridden inline.");

  const appendix = page.locator("[data-folded-prose]");
  await expect(
    appendix.getByText("How the spacing coupling was checked"),
  ).toBeVisible();
  await expect(
    page.getByText(/Both flush-band consumers were traced/),
  ).toHaveCount(0);
  await appendix.getByRole("button").click();
  await expect(
    page.getByText(/Both flush-band consumers were traced/),
  ).toBeVisible();
});

test("a needs-changes review opens blocking evidence and folds the minors", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Blocking evidence",
    blocks: [
      {
        id: "verdict",
        type: "callout",
        data: {
          tone: "risk",
          markdown: "**The retry loop drops the last error.**",
          recommendation: "needs-changes",
        },
      },
      {
        id: "blocking-diff",
        type: "diff",
        summary: "The catch swallows the terminal failure",
        severity: "blocking",
        data: {
          filename: "src/retry.ts",
          before: "throw lastError;",
          after: "return null;",
          mode: "unified",
          annotations: [],
        },
      },
      {
        id: "minor-naming",
        type: "diff",
        summary: "The helper name still says retryOnce",
        severity: "minor",
        data: {
          filename: "src/retryName.ts",
          before: "function retryOnce() {}",
          after: "function retryMany() {}",
          mode: "unified",
          annotations: [],
        },
      },
    ],
  });

  await page.goto(`/reviews/${published.review.id}`);
  await expect(
    page.locator('[data-recommendation="needs-changes"]'),
  ).toHaveText("Needs changes");

  await expect(page.getByText("return null;")).toBeVisible();
  await expect(page.getByText("blocking", { exact: true })).toBeVisible();

  const asideGroup = page.locator('[data-evidence-aside="true"]');
  await expect(
    asideGroup.getByRole("heading", { name: "Minor findings (1)" }),
  ).toBeVisible();
  await expect(page.getByText("function retryMany() {}")).toHaveCount(0);
});
