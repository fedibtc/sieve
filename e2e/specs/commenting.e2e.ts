import { allBlockTypes, publishFixtureReview } from "../helpers/api";
import { expect, test } from "../helpers/fixtures";
import { dragSelectText } from "../helpers/selection";

test("block, file, text quote, routing, and persistence work through the real UI", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Commenting fixture",
    blocks: allBlockTypes(),
  });
  await page.goto(`/reviews/${published.review.id}`);

  const block = page.locator("article").filter({ hasText: "Markdown" }).first();
  await block.hover();
  await block.getByRole("button", { name: /Comment on block/ }).click();
  await page.getByLabel("Comment text").fill("Please update this block");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Please update this block")).toBeVisible();
  await expect(page.getByRole("button", { name: /Needs agent/ })).toBeVisible();

  const fileRow = page.getByText("src/b.ts").locator("..").locator("..");
  await fileRow.hover();
  await page.getByRole("button", { name: "Comment on src/b.ts" }).click();
  await page.getByLabel("Comment text").fill("File-level note");
  await page
    .getByRole("button", { exact: true, name: "FYI for humans" })
    .click();
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(
    page.getByRole("button", { name: /FYI for humans 1/ }),
  ).toBeVisible();
  await expect(page.getByText("File-level note")).toBeVisible();

  await dragSelectText(
    page,
    page
      .locator("article#selectable-rich")
      .getByText("This rich note can be selected."),
  );
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await expect(
    page.getByRole("button", { name: /This rich note can/ }),
  ).toBeVisible();
  await page.getByLabel("Comment text").fill("Text quote note");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Text quote note")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Please update this block")).toBeVisible();
  await expect(page.getByText("File-level note")).toBeVisible();
  await expect(page.getByText("Text quote note")).toBeVisible();
});
