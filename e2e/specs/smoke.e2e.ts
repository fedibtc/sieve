import { whoami } from "../helpers/api";
import { expectHittable } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("seeded review loads and localhost auth bypass works", async ({
  page,
  request,
}) => {
  const response = await whoami(request);
  expect(response.status()).toBe(200);
  await expect(await response.json()).toMatchObject({
    user: { id: "local-dev-user" },
  });

  await page.goto("/reviews/seed-credential-app-qr");
  await expect(
    page.getByRole("heading", { name: "Credential-app QR property coverage" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(9);
  await expectHittable(page.getByRole("link", { name: "Reviews" }).first());
});
