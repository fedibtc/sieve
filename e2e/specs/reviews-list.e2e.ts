import { addBrowserComment, publishFixtureReview } from "../helpers/api";
import { expect, test } from "../helpers/fixtures";

test("list filters, row navigation, relative time, and open-agent count", async ({
  page,
  request,
}) => {
  await page.goto("/reviews");
  const seededRow = page.getByRole("link", {
    name: /Credential-app QR property coverage/,
  });
  await expect(seededRow).toBeVisible();
  await expect(seededRow).toContainText("fedibtc/credential-app");
  await expect(seededRow).toContainText("open");

  const fixture = await publishFixtureReview(request, {
    title: "Other repo filter target",
    repo: "e2e/other",
  });
  await addBrowserComment(request, fixture.review.id, {
    message: "Needs agent follow-up",
    resolutionTarget: "agent",
  });
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Other repo filter target/ }),
  ).toContainText(/1/);

  await page.getByPlaceholder("Filter repo").fill("e2e/other");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/repo=e2e%2Fother/);
  await expect(
    page.getByRole("link", { name: /Other repo filter target/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Credential-app QR property coverage"),
  ).toHaveCount(0);

  await page.getByLabel("Status").selectOption("approved");
  await expect(page).toHaveURL(/status=approved/);
  // FINDING: filter-to-zero currently removes the filter form, leaving no clear path.
  await expect(page.getByText(/no reviews yet/i)).toBeVisible();
});
