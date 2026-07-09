import { describe, expect, it } from "vitest";
import { getAllowedDomains, isAllowedEmailDomain } from "./env";

describe("auth domain policy", () => {
  it("parses comma-separated allowed domains", () => {
    expect(
      getAllowedDomains({
        AUTH_ALLOWED_DOMAINS: "fedibtc.com, example.org ",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual(["fedibtc.com", "example.org"]);
  });

  it("accepts only configured email domains", () => {
    expect(isAllowedEmailDomain("alice@fedibtc.com", ["fedibtc.com"])).toBe(
      true,
    );
    expect(isAllowedEmailDomain("mallory@example.com", ["fedibtc.com"])).toBe(
      false,
    );
    expect(isAllowedEmailDomain("not-an-email", ["fedibtc.com"])).toBe(false);
  });
});
