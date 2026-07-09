import { expect, test } from "../helpers/fixtures";

test("empty database cold-starts, shows empty review and token states", async ({
  page,
}) => {
  await page.goto("/reviews");
  await expect(page.getByText(/no reviews yet/i)).toBeVisible();
  await page.getByRole("link", { name: /mint an agent token/i }).click();
  await expect(page).toHaveURL(/\/settings\/tokens/);
  await expect(page.getByText("No tokens yet")).toBeVisible();
});
