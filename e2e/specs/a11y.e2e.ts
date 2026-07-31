import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../helpers/fixtures";

for (const path of [
  "/reviews",
  "/reviews/seed-credential-app-qr",
  "/settings/tokens",
  "/login",
  "/device",
  "/gallery",
]) {
  test(`critical and serious axe smoke: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    );
    expect(serious).toEqual([]);
  });
}
