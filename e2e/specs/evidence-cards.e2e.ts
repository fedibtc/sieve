import {
  addBrowserComment,
  keyChangesGroup,
  keyChangesWithProseReference,
  publishFixtureReview,
} from "../helpers/api";
import { expectBelowStickyChrome } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("an evidence set renders as collapsed claim cards and thread anchors expand the right card", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Evidence cards",
    blocks: keyChangesGroup(),
  });
  await addBrowserComment(request, published.review.id, {
    message: "Check this second file",
    anchor: { blockId: "key-code-two", kind: "block" },
    resolutionTarget: "agent",
  });

  await page.goto(`/reviews/${published.review.id}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Key changes" }),
  ).toBeVisible();

  await expect(page.getByText("First file", { exact: true })).toBeVisible();
  await expect(page.getByText("Second file", { exact: true })).toBeVisible();
  await expect(page.getByText("export const two = true;")).toHaveCount(0);

  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(page.getByText("const one = true;")).toBeVisible();
  await expect(page.getByText("export const two = true;")).toBeVisible();

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(page.getByText("export const two = true;")).toHaveCount(0);

  await page.getByRole("link", { name: "key-code-two" }).click();
  await expect(page.getByText("export const two = true;")).toBeVisible();
  await expectBelowStickyChrome(
    page,
    page.getByText("export const two = true;"),
  );
});

test("a finding's evidence reference expands the card and the back button returns", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Evidence references",
    blocks: keyChangesWithProseReference(),
  });

  await page.goto(`/reviews/${published.review.id}`);
  const reference = page.getByRole("button", {
    name: "src/flags/beta.ts",
    exact: true,
  });
  await expect(reference).toBeVisible();
  await expect(page.getByText("export const beta = true;")).toHaveCount(0);

  await reference.click();
  await expect(page.getByText("export const beta = true;")).toBeVisible();
  await expect(page).toHaveURL(/#key-beta$/);

  // The jump is a history entry, so the browser back button is the way back.
  await page.goBack();
  await expect(page).not.toHaveURL(/#key-beta/);
  await expect(reference).toBeInViewport();
});

test("a deep link to an evidence block opens its card on load", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Evidence deep link",
    blocks: keyChangesWithProseReference(),
  });

  await page.goto(`/reviews/${published.review.id}#key-beta`);
  await expect(page.getByText("export const beta = true;")).toBeVisible();
  await expectBelowStickyChrome(
    page,
    page.getByText("export const beta = true;"),
  );
});

test("a fenced code sample that reads like a filename stays plain text", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Fenced samples are not references",
    blocks: keyChangesWithProseReference(),
  });

  await page.goto(`/reviews/${published.review.id}`);
  await expect(
    page.getByRole("button", { name: "src/flags/beta.ts", exact: true }),
  ).toHaveCount(1);
});
