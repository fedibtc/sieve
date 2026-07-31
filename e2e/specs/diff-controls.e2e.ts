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

test("annotations render inline beside their lines with range brackets", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Inline annotations",
    blocks: [
      {
        id: "annotated-diff",
        type: "diff",
        summary: "Annotated change",
        data: {
          filename: "src/notes.ts",
          language: "ts",
          mode: "split",
          before: "const label = value;\nconst other = 2;\nconst tail = 1;\n",
          after:
            "const label = format(value);\nconst other = 2;\nconst tail = 1;\n",
          annotations: [
            {
              side: "after",
              lines: "1-2",
              label: "formatting",
              note: "Labels are formatted before display.",
            },
            {
              side: "before",
              lines: "1",
              label: "old value",
              note: "The raw value used to leak through.",
            },
          ],
        },
      },
    ],
  });

  await page.goto(published.url);
  const diff = page.locator("article#annotated-diff");

  // Notes are plain visible text below their lines; no hover or side rail.
  const cards = diff.locator("[data-diff-annotation]");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("old value");
  await expect(cards.first()).toContainText("old line 1");
  await expect(cards.first()).toContainText(
    "The raw value used to leak through.",
  );
  await expect(cards.nth(1)).toContainText("formatting");
  await expect(cards.nth(1)).toContainText("lines 1–2");
  await expect(cards.nth(1)).toContainText(
    "Labels are formatted before display.",
  );

  // The gutter shows one bracket segment per annotated line:
  // after lines 1-2 plus before line 1.
  await expect(diff.locator("[data-annotation-bracket]")).toHaveCount(3);

  // Modified lines highlight the changed words, not just the whole line.
  const firstRowAfterCell = diff.locator("[data-diff-code-cell]").nth(1);
  const emphasized = await firstRowAfterCell
    .locator("[data-diff-emphasis]")
    .allTextContents();
  expect(emphasized.join("")).toContain("format(");
});

test("collapsed context rows name their hidden line range", async ({
  page,
  request,
}) => {
  const context = Array.from(
    { length: 28 },
    (_, index) => `const x${index + 2} = ${index + 2};`,
  );
  const published = await publishFixtureReview(request, {
    title: "Collapsed context",
    blocks: [
      {
        id: "collapsed-context",
        type: "diff",
        summary: "Edge changes",
        data: {
          filename: "src/edges.ts",
          language: "ts",
          mode: "unified",
          before: ["const start = 1;", ...context, "const end = 1;"].join("\n"),
          after: ["const start = 2;", ...context, "const end = 2;"].join("\n"),
          annotations: [],
        },
      },
    ],
  });

  await page.goto(published.url);
  const collapse = page.getByRole("button", {
    name: /22 unchanged lines \(5–26\)/,
  });
  await expect(collapse).toBeVisible();
  await collapse.click();
  await expect(
    page
      .locator("article#collapsed-context")
      .getByText("const x15 = 15;")
      .first(),
  ).toBeVisible();
});

test("the diff header sticks under the app chrome while scrolling", async ({
  page,
  request,
}) => {
  const before = Array.from(
    { length: 60 },
    (_, index) => `old ${index + 1}`,
  ).join("\n");
  const after = Array.from(
    { length: 60 },
    (_, index) => `new ${index + 1}`,
  ).join("\n");
  const published = await publishFixtureReview(request, {
    title: "Sticky diff header",
    blocks: [
      {
        id: "sticky-header-diff",
        type: "diff",
        summary: "Long modified file",
        data: {
          filename: "src/sticky.ts",
          language: "ts",
          mode: "unified",
          before,
          after,
          annotations: [],
        },
      },
    ],
  });

  await page.goto(published.url);
  const diff = page.locator("article#sticky-header-diff");
  await diff.getByText("new 57", { exact: true }).scrollIntoViewIfNeeded();
  const header = diff.locator("[data-diff-header]");
  await expect(header).toBeVisible();
  const box = await header.boundingBox();
  // The app chrome is 48px tall; the diff header pins directly below it.
  expect(box?.y).toBeGreaterThanOrEqual(47);
  expect(box?.y).toBeLessThanOrEqual(49);
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
