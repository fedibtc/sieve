import { describe, expect, it } from "vitest";
import { getAuthCallbackURL, getLoginURL } from "./auth-redirect";

describe("authentication redirects", () => {
  it("preserves internal paths and query parameters", () => {
    const callbackURL = "/device?user_code=ABCD2345";

    expect(getAuthCallbackURL(callbackURL)).toBe(callbackURL);
    expect(getLoginURL(callbackURL)).toBe(
      "/login?next=%2Fdevice%3Fuser_code%3DABCD2345",
    );
  });

  it.each([
    "https://example.com/device",
    "//example.com/device",
    "/\\example.com/device",
    "device",
  ])("rejects an unsafe callback URL: %s", (callbackURL) => {
    expect(getAuthCallbackURL(callbackURL)).toBe("/reviews");
  });
});
