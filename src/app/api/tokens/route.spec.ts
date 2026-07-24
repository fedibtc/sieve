import { beforeEach, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth";
import { resetDbForTests } from "@/server/db/client";
import { POST } from "./route";

describe("token API authentication", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://token-route-${crypto.randomUUID()}`;
    delete process.env.VERCEL;
    resetDbForTests();
    resetAuthForTests();
  });

  it("returns a JSON 401 instead of redirecting an invalid bearer token", async () => {
    const response = await POST(
      new Request("https://reviews.example.com/api/tokens", {
        method: "POST",
        headers: {
          authorization: "Bearer invalid-device-session",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "sieve cli" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
