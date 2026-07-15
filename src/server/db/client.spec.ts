import { afterEach, describe, expect, it, vi } from "vitest";

describe("database client lifecycle", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reuses one database client across development module reloads", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgres://unused:unused@localhost:1/unused");

    const firstModule = await import("./client");
    const first = await firstModule.getDb();
    vi.resetModules();
    const reloadedModule = await import("./client");
    const reloaded = await reloadedModule.getDb();

    expect(reloaded).toBe(first);
    reloadedModule.resetDbForTests();
  });
});
