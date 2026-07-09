import { whoami } from "../helpers/api";
import { expectBelowStickyChrome } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("token lifecycle mints, copies, authenticates, and revokes", async ({
  page,
  request,
}) => {
  await page.goto("/settings/tokens");
  await page.getByLabel("Token name").fill("E2E agent");
  await page.getByRole("button", { name: "Mint token" }).click();
  const callout = page.getByText("Copy this token now");
  await expect(callout).toBeVisible();
  await expectBelowStickyChrome(page, callout);
  await page.getByRole("button", { name: "Copy token" }).click();
  const token = await page.evaluate(() => navigator.clipboard.readText());
  expect(token).toMatch(/^sieve_/);
  expect((await whoami(request, token)).status()).toBe(200);

  await page.getByRole("button", { name: "Copy CLI bearer" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain(token);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Revoke this token?");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Revoke token" }).first().click();
  await expect(page.getByText("E2E agent")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Revoke this token?");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Revoke token" }).first().click();
  await expect(page.getByText("E2E agent")).toHaveCount(0);
  expect((await whoami(request, token)).status()).toBe(401);
});
