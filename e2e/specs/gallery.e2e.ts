import { galleryEntries } from "../../src/shared/gallery";
import { expectHittable } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("every gallery entry renders from the sidebar", async ({ page }) => {
  await page.goto("/gallery");
  await expect(
    page.getByRole("heading", { name: "Block gallery" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Gallery entries" });
  for (const entry of galleryEntries) {
    await nav.getByRole("button", { name: entry.title, exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: entry.title }),
    ).toBeVisible();
    await expect(page.locator("[data-gallery-canvas] article")).not.toHaveCount(
      0,
    );
  }
});

test("hash deep-links select an entry", async ({ page }) => {
  await page.goto("/gallery#diff-annotated");
  await expect(
    page.getByRole("heading", { level: 2, name: "Diff with annotations" }),
  ).toBeVisible();
  await expect(page.getByText("Duration formatting hardening")).toBeVisible();
});

test("gallery interactions emit anchor events", async ({ page }) => {
  await page.goto("/gallery#diff-annotated");
  const events = page.locator("[data-gallery-events]");
  await expect(events).toContainText("Interact with the block");

  const lineButton = page.getByTitle("Comment on after line 2");
  await lineButton.scrollIntoViewIfNeeded();
  await expectHittable(lineButton);
  await lineButton.click();
  await expect(events).toContainText('"kind": "line"');
  await expect(events).toContainText('"start": 2');

  await page
    .getByRole("navigation", { name: "Gallery entries" })
    .getByRole("button", { name: "Question form", exact: true })
    .click();
  await page.getByRole("button", { name: "throw", exact: true }).click();
  await page.getByRole("button", { name: "Post answer" }).first().click();
  await expect(events).toContainText("answer");
  await expect(events).toContainText('"gallery-q-single"');
});

test("gallery diff controls work without a review", async ({ page }) => {
  await page.goto("/gallery#diff-annotated");
  const diff = page.locator("article#gallery-diff-annotated");
  await diff.getByRole("button", { name: "unified" }).click();
  await expect(diff.getByRole("button", { name: "unified" })).toHaveClass(
    /bg-primary/,
  );
  await diff.getByRole("button", { name: "split" }).click();

  await page
    .getByRole("navigation", { name: "Gallery entries" })
    .getByRole("button", { name: "Long diff with collapsed context" })
    .click();
  const collapsed = page.getByRole("button", { name: /unchanged lines/ });
  await expect(collapsed.first()).toBeVisible();
  await collapsed.first().click();
  await expect(
    page
      .locator("article#gallery-diff-long")
      .getByText("setting10", { exact: false })
      .first(),
  ).toBeVisible();
});
