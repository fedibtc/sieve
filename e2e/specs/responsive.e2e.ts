import { expectNoHorizontalOverflow } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("mobile list, detail, tokens, and unified diff stay operable", async ({
  page,
}) => {
  await page.goto("/reviews");
  await expectNoHorizontalOverflow(page);
  await page.goto("/reviews/seed-credential-app-qr");
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("button", { name: "Split" })).toHaveCount(0);
  const block = page.locator("article").filter({ hasText: "Outcome" }).first();
  await block.hover();
  await block.getByRole("button", { name: /Comment on block/ }).click();
  await page.getByLabel("Comment text").fill("Mobile comment");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Mobile comment")).toBeVisible();

  await page.goto("/settings/tokens");
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole("heading", { name: "Agent tokens" }),
  ).toBeVisible();
});
