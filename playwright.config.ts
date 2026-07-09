import { defineConfig, devices } from "@playwright/test";

const seededPort = 3100;
const emptyPort = 3101;

export default defineConfig({
  testDir: "./e2e/specs",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html"]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: [
    {
      command:
        "node scripts/e2e-server.mjs --port 3100 --scratch .e2e-db/seeded --seed",
      url: `http://127.0.0.1:${seededPort}/reviews`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "node scripts/e2e-server.mjs --port 3101 --scratch .e2e-db/empty",
      url: `http://127.0.0.1:${emptyPort}/reviews`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "desktop",
      testIgnore: [/responsive\.e2e\.ts/, /empty-db\.e2e\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${seededPort}`,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: /responsive\.e2e\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${seededPort}`,
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
    {
      name: "empty-db",
      testMatch: /empty-db\.e2e\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${emptyPort}`,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
