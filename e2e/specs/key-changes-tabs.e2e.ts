import {
  addBrowserComment,
  keyChangesGroup,
  publishFixtureReview,
} from "../helpers/api";
import { expectBelowStickyChrome } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("key changes group renders as tabs and thread anchors activate hidden tabs", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Key changes tabs",
    blocks: keyChangesGroup(),
  });
  await addBrowserComment(request, published.review.id, {
    message: "Check this second file",
    anchor: { blockId: "key-code-two", kind: "block" },
    resolutionTarget: "agent",
  });

  await page.goto(`/reviews/${published.review.id}`);
  await expect(
    page.getByRole("button", { name: /src\/one\.ts|First file/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /src\/two\.ts|Second file/ }).click();
  await expect(page.getByText("export const two = true;")).toBeVisible();

  await page.getByRole("button", { name: /src\/one\.ts|First file/ }).click();
  await expect(page.getByText("export const two = true;")).toHaveCount(0);
  await page.getByRole("link", { name: "key-code-two" }).click();
  await page.getByRole("button", { name: /src\/two\.ts|Second file/ }).click();
  await expect(page.getByText("export const two = true;")).toBeVisible();
  await expectBelowStickyChrome(
    page,
    page.getByText("export const two = true;"),
  );
});
