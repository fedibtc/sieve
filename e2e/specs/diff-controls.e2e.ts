import { publishFixtureReview } from "../helpers/api";
import { expectHittable } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("diff mode persists and syncs across tabs", async ({ context, page }) => {
  await page.goto("/reviews/seed-credential-app-qr");
  await page.getByRole("button", { name: "Unified" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("sieve:diff-view-mode")),
  ).toBe("unified");

  await page.reload();
  await expect(page.getByRole("button", { name: "Unified" })).toHaveClass(
    /bg-primary/,
  );

  const second = await context.newPage();
  await second.goto("/reviews/seed-credential-app-qr");
  await page.getByRole("button", { name: "Split" }).click();
  await expect
    .poll(() =>
      second.evaluate(() => localStorage.getItem("sieve:diff-view-mode")),
    )
    .toBe("split");
});

test("gutter comment controls reveal on hover and set a line anchor", async ({
  page,
}) => {
  await page.goto("/reviews/seed-credential-app-qr");
  const button = page.getByTitle(/Comment on after line/).first();
  await button.locator("..").hover();
  await expectHittable(button);
  await button.click();
  await expect(page.getByTitle("Clear anchor")).toContainText(/after:\d+/);
});

test("one-sided diffs use the full code surface", async ({ page, request }) => {
  const published = await publishFixtureReview(request, {
    title: "Added file diff",
    blocks: [
      {
        id: "added-only",
        type: "diff",
        summary: "Added accessibility coverage",
        data: {
          filename: "e2e/accessibility/app-accessibility.spec.ts",
          language: "ts",
          mode: "split",
          before: "",
          after:
            'import AxeBuilder from "@axe-core/playwright";\n\ntest("has no serious violations", async ({ page }) => {\n  const results = await new AxeBuilder({ page }).analyze();\n  expect(results.violations).toEqual([]);\n});',
          annotations: [
            {
              side: "after",
              lines: "3-5",
              label: "Coverage",
              note: "The added test is visible without an empty before pane.",
            },
          ],
        },
      },
    ],
  });

  await page.goto(published.url);
  const diff = page.locator("article#added-only");
  await expect(diff.getByRole("button", { name: "Split" })).toHaveCount(0);
  await expect(diff.getByText(/new AxeBuilder/)).toBeVisible();
  await expect(diff.getByTitle("Comment on after line 3")).toBeVisible();
  await expect(diff.getByTitle("Comment on before line 3")).toHaveCount(0);
});

test("long split lines stay inside their own side", async ({
  page,
  request,
}) => {
  const longBefore = `const before = <Tabs.Root className="${"previous-layout ".repeat(12)}" />;`;
  const longAfter = `const after = <Tabs.Root className="${"current-layout ".repeat(12)}" />;`;
  const published = await publishFixtureReview(request, {
    title: "Long split diff",
    blocks: [
      {
        id: "long-split-lines",
        type: "diff",
        summary: "Long split lines",
        data: {
          filename: "src/features/holder/HolderMode.tsx",
          language: "tsx",
          mode: "split",
          before: longBefore,
          after: longAfter,
          annotations: [],
        },
      },
    ],
  });

  await page.goto(published.url);
  const diff = page.locator("article#long-split-lines");
  await diff.getByRole("button", { name: "Split" }).click();
  const cells = diff.locator("[data-diff-code-cell]");
  await expect(cells).toHaveCount(2);
  await expect
    .poll(() =>
      cells.evaluateAll((elements) =>
        elements.every(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ),
    )
    .toBe(true);
  await expect(diff.getByText(/current-layout/)).toBeVisible();
});
