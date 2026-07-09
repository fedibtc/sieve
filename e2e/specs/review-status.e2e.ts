import { publishFixtureReview } from "../helpers/api";
import { expect, test } from "../helpers/fixtures";

test("approve, cancel, request changes, reopen, audit events, and agent guard", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Status fixture",
  });
  await page.goto(`/reviews/${published.review.id}`);

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approve review?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Approve review?")).toHaveCount(0);

  await page.getByRole("button", { name: "Request changes" }).click();
  await expect(page.getByText("Changes requested")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Changes requested")).toBeVisible();
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByText("Open")).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Approved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

  const events = await request.get(
    `/api/reviews/${published.review.id}/events`,
  );
  expect(events.ok()).toBe(true);
  expect(JSON.stringify(await events.json())).toContain(
    "review.status_changed",
  );

  const guard = await request.post(
    `/api/agent/v1/reviews/${published.review.id}/status`,
    { data: { status: "approved" } },
  );
  expect(guard.status()).toBe(400);
});
