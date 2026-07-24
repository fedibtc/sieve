import { expectHittable } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("app shell navigation, breadcrumb, PR link, login, and 404 render", async ({
  page,
}) => {
  await page.goto("/reviews");
  await expectHittable(page.getByRole("link", { name: "sieve" }));
  await page.getByRole("link", { name: "Tokens" }).click();
  await expect(page).toHaveURL(/\/settings\/tokens/);
  await expect(
    page.getByRole("heading", { name: "Agent tokens" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reviews" }).click();
  await expect(page).toHaveURL(/\/reviews/);
  await expect(page.getByText("Local Dev")).toBeVisible();

  await page.goto("/reviews/seed-credential-app-qr");
  await page.getByRole("link", { name: "Reviews" }).first().click();
  await expect(page).toHaveURL(/\/reviews$/);

  await page.goto("/login?error=oauth");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expectHittable(
    page.getByRole("button", { name: "Continue with GitHub" }),
  );
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
  await expect(page.getByText(/sign-in failed/i)).toBeVisible();

  const missing = await page.goto("/reviews/does-not-exist");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText(/404|not found/i)).toBeVisible();
});
