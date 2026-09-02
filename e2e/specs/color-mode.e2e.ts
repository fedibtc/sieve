import type { Page } from "@playwright/test";
import { expectHittable } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

const darkCanvas = "rgb(13, 17, 23)";
const lightCanvas = "rgb(255, 255, 255)";

function bodyBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test("the color mode select applies, persists, and follows the system under auto", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/reviews");
  const select = page.getByLabel("Color mode");
  await expectHittable(select);
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "auto");
  expect(await bodyBackground(page)).toBe(lightCanvas);

  await select.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await expect.poll(() => bodyBackground(page)).toBe(darkCanvas);
  expect(
    await page.evaluate(() => localStorage.getItem("sieve:color-mode")),
  ).toBe("dark");

  // The stored choice lands before the first paint on every page.
  await page.goto("/reviews/seed-credential-app-qr");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  expect(await bodyBackground(page)).toBe(darkCanvas);
  await expect(page.getByLabel("Color mode")).toHaveValue("dark");

  await page.getByLabel("Color mode").selectOption("light");
  await expect.poll(() => bodyBackground(page)).toBe(lightCanvas);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await bodyBackground(page)).toBe(lightCanvas);

  await page.getByLabel("Color mode").selectOption("auto");
  await expect.poll(() => bodyBackground(page)).toBe(darkCanvas);
  expect(
    await page.evaluate(() => localStorage.getItem("sieve:color-mode")),
  ).toBeNull();
});
