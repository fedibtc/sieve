import {
  expectBelowStickyChrome,
  expectHittable,
  expectRevealedOnHover,
} from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("sticky chrome and overlays do not obscure core controls", async ({
  page,
}) => {
  await page.goto("/reviews/seed-credential-app-qr");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  const values = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll("header.sticky")).map(
      (node) => node.getBoundingClientRect().bottom,
    );
    const aside = document.querySelector("aside")?.getBoundingClientRect();
    return {
      stickyBottom: Math.max(...headers, 0),
      asideTop: aside?.top ?? 0,
    };
  });
  expect(values.asideTop).toBeGreaterThanOrEqual(values.stickyBottom - 1);

  const target = page.getByText("Issuer flow wiring").first();
  await target.scrollIntoViewIfNeeded();
  await expectBelowStickyChrome(page, target);

  const block = page.locator("article").filter({ hasText: "Outcome" }).first();
  await expectRevealedOnHover(
    block,
    block.getByRole("button", { name: /Comment on block/ }),
  );

  const thumbnail = page.getByRole("img", {
    name: /credential-acceptance after/i,
  });
  await thumbnail.click();
  const close = page.getByRole("button", { name: /close image/i });
  await expectHittable(close);
  await page.keyboard.press("Escape");
});
