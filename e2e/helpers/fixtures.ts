import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ consoleGuard: undefined }>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          // sync-polling intentionally aborts requests to exercise reconnect UI.
          if (
            message.text().includes("Failed to load resource: net::ERR_FAILED")
          ) {
            return;
          }
          if (
            message
              .text()
              .includes(
                "Failed to load resource: the server responded with a status of 404",
              )
          ) {
            return;
          }
          errors.push(message.text());
        }
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(undefined);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
