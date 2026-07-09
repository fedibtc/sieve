import { expect, type Locator, type Page } from "@playwright/test";

export async function expectHittable(locator: Locator) {
  await expect(locator).toBeVisible();
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let current: Element | null = element;
    let opacity = 1;
    let visibility = "visible";
    while (current) {
      const style = window.getComputedStyle(current);
      opacity *= Number(style.opacity || "1");
      if (style.visibility === "hidden") {
        visibility = "hidden";
      }
      current = current.parentElement;
    }
    const hit = document.elementFromPoint(centerX, centerY);
    return {
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      opacity,
      visibility,
      hitOk: hit === element || element.contains(hit),
      hitTag: hit?.tagName ?? null,
    };
  });

  expect(result.rect.width).toBeGreaterThan(0);
  expect(result.rect.height).toBeGreaterThan(0);
  expect(result.rect.left).toBeGreaterThanOrEqual(0);
  expect(result.rect.top).toBeGreaterThanOrEqual(0);
  expect(result.rect.right).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.rect.bottom).toBeLessThanOrEqual(result.viewportHeight + 1);
  expect(result.opacity).toBeGreaterThan(0.1);
  expect(result.visibility).toBe("visible");
  expect(result.hitOk, `center point hit ${result.hitTag}`).toBe(true);
}

export async function effectiveOpacity(locator: Locator) {
  return locator.evaluate((element) => {
    let current: Element | null = element;
    let opacity = 1;
    while (current) {
      opacity *= Number(window.getComputedStyle(current).opacity || "1");
      current = current.parentElement;
    }
    return opacity;
  });
}

export async function expectRevealedOnHover(
  trigger: Locator,
  control: Locator,
) {
  if ((await control.count()) > 0) {
    expect(await effectiveOpacity(control.first())).toBeLessThan(0.2);
  }
  await trigger.hover();
  await expect
    .poll(() => effectiveOpacity(control.first()))
    .toBeGreaterThan(0.85);
  await expectHittable(control.first());
}

export async function expectBelowStickyChrome(_page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const result = await locator.evaluate((element) => {
    const stickyBottom = Array.from(document.querySelectorAll("header.sticky"))
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.top <= 160)
      .reduce((bottom, rect) => Math.max(bottom, rect.bottom), 0);
    return { stickyBottom, top: element.getBoundingClientRect().top };
  });
  expect(result.top).toBeGreaterThanOrEqual(result.stickyBottom - 1);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
    innerWidth: window.innerWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth + 1);
}
