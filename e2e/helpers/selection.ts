import type { Locator, Page } from "@playwright/test";

export async function dragSelectText(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const handle = await locator.elementHandle();
  if (!handle) {
    throw new Error("No text element found for selection");
  }
  await page.waitForFunction((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  }, handle);
  const rect = await locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node) {
      throw new Error("No text node found for selection");
    }
    const range = document.createRange();
    const textLength = node.textContent?.length ?? 0;
    range.setStart(node, 0);
    range.setEnd(node, Math.min(textLength, 18));
    const firstRect = range.getClientRects()[0];
    if (!firstRect) {
      throw new Error("No selectable rect found");
    }
    return {
      left: Math.max(0, firstRect.left),
      right: Math.min(window.innerWidth, firstRect.right),
      top: Math.max(0, firstRect.top),
      bottom: Math.min(window.innerHeight, firstRect.bottom),
    };
  });
  const y = (rect.top + rect.bottom) / 2;
  const startX = rect.left + 2;
  const endX = Math.max(startX + 16, rect.right - 2);
  const hitTest = await locator.evaluate(
    (element, point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      const targetAnchor = element.closest("[data-text-anchorable]");
      const hitAnchor = hit?.closest("[data-text-anchorable]");
      return {
        hitTag: hit?.tagName ?? null,
        hitText: hit?.textContent?.slice(0, 80) ?? null,
        ok:
          hit === element ||
          element.contains(hit) ||
          hitAnchor === targetAnchor,
        point,
        targetText: element.textContent?.slice(0, 80) ?? null,
      };
    },
    { x: startX, y },
  );
  if (!hitTest.ok) {
    throw new Error(
      `Text selection drag would not start on target text: ${JSON.stringify(hitTest)}`,
    );
  }
  await page.keyboard.press("Escape");
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => !window.getSelection()?.isCollapsed);
}
