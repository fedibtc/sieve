import { addBrowserComment, publishFixtureReview } from "../helpers/api";
import { expect, test } from "../helpers/fixtures";

test("reply, resolve, reopen, and unconsumed marker move a thread through groups", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Threads fixture",
  });
  await addBrowserComment(request, published.review.id, {
    message: "Thread root",
    resolutionTarget: "agent",
  });
  await page.goto(`/reviews/${published.review.id}`);

  await expect(page.getByTitle("Agent has not pulled this yet")).toBeVisible();
  await page.getByRole("button", { name: "Reply" }).click();
  await page.getByPlaceholder("Reply in thread").fill("Human reply");
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("Human reply")).toBeVisible();

  await page.getByRole("button", { name: "Resolve thread" }).click();
  await page.getByRole("button", { name: "Resolved" }).click();
  await expect(page.getByText("Thread root")).toBeVisible();
  await page.getByRole("button", { name: "Reopen thread" }).click();
  await expect(page.getByRole("button", { name: /Needs agent/ })).toBeVisible();
});
