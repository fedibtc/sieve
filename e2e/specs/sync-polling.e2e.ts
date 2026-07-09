import type { Route } from "@playwright/test";
import { addBrowserComment, publishFixtureReview } from "../helpers/api";
import { expect, test } from "../helpers/fixtures";

test("polling brings in new comments without reload", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Polling fixture",
  });
  await page.goto(`/reviews/${published.review.id}`);
  await addBrowserComment(request, published.review.id, {
    message: "Arrived over polling",
    resolutionTarget: "agent",
  });
  await expect(page.getByText("Arrived over polling")).toBeVisible({
    timeout: 15_000,
  });
});

test("polling surfaces reconnecting state after repeated failures", async ({
  page,
  request,
}) => {
  const published = await publishFixtureReview(request, {
    title: "Polling failure fixture",
  });
  await page.goto(`/reviews/${published.review.id}`);
  const reviewRoute = /\/api\/reviews\/[^/]+$/;
  const abortReview = (route: Route) => route.abort();
  await page.route(reviewRoute, abortReview);
  await expect(page.getByText(/reconnecting/i)).toBeVisible({
    timeout: 25_000,
  });
  await page.unroute(reviewRoute, abortReview);
  await addBrowserComment(request, published.review.id, {
    message: "Recovered polling",
    resolutionTarget: "agent",
  });
  await page.reload();
  await expect(page.getByText("Recovered polling")).toBeVisible({
    timeout: 15_000,
  });
});
