import { expectHittable, expectRevealedOnHover } from "../helpers/assertions";
import { expect, test } from "../helpers/fixtures";

test("seeded reviewer journey composes read-only interactions", async ({
  page,
}) => {
  await page.goto("/reviews/seed-credential-app-qr");

  await expect(page.getByRole("heading", { name: "Outcome" })).toBeVisible();
  await expect(
    page.getByText(/QR\/property coverage, adds Playwright harness checks/),
  ).toBeVisible();
  await expect(page.getByText("Visual comparison")).toBeVisible();
  await expect(page.locator('[data-visual-panel="merge-base"]')).toBeVisible();
  await expect(page.locator('[data-visual-panel="this branch"]')).toBeVisible();
  await expect(page.locator('[data-visual-panel="diff"]')).toBeVisible();

  const endpoint = page.getByRole("button", {
    name: /QR: credential-offer payload/,
  });
  await endpoint.scrollIntoViewIfNeeded();
  await expectHittable(endpoint);
  await endpoint.click();
  await expect(page.getByText("roundTrip")).toBeVisible();

  await page.getByRole("button", { name: "Unified" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("sieve:diff-view-mode")),
  ).toBe("unified");

  const thumbnail = page.getByRole("img", {
    name: /credential-acceptance .*this branch/i,
  });
  await thumbnail.scrollIntoViewIfNeeded();
  await expectHittable(thumbnail);
  await thumbnail.click();
  await expect(
    page.getByRole("button", { name: /close image/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /close image/i }).click();
  await expect(page.getByRole("button", { name: /close image/i })).toHaveCount(
    0,
  );

  const diagramBlock = page.locator("article#flow-diagram");
  await expect(diagramBlock.locator("[role='img'] svg").first()).toBeVisible({
    timeout: 15_000,
  });
  const expandDiagram = diagramBlock.getByRole("button", {
    name: /Expand diagram/i,
  });
  await expectRevealedOnHover(diagramBlock, expandDiagram);
  await expandDiagram.click();
  await expect(
    page.getByRole("button", { name: "Close diagram" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close diagram" }).click();
  await expect(page.getByRole("button", { name: "Close diagram" })).toHaveCount(
    0,
  );

  expect(
    await page.evaluate(() => localStorage.getItem("sieve:diff-view-mode")),
  ).toBe("unified");

  await page
    .getByRole("button", {
      name: /src\/credential\/domain\/qrPayloads\.property\.test\.ts/,
    })
    .click();
  await expect(page.getByTitle("Clear anchor")).toContainText(
    "qrPayloads.property.test.ts",
  );
});
