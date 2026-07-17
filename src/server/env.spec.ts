import { describe, expect, it } from "vitest";
import {
  getAllowedDomains,
  getAllowedGithubUsers,
  isAllowedEmailDomain,
  isAllowedGithubUser,
} from "./env";

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

describe("github login allowlist", () => {
  it("parses comma-separated logins case-insensitively", () => {
    expect(
      getAllowedGithubUsers({
        AUTH_ALLOWED_GITHUB_USERS: "OTech47, daviroo ",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual(["otech47", "daviroo"]);
  });

  it("accepts only allowlisted logins", () => {
    expect(isAllowedGithubUser("otech47", ["otech47"])).toBe(true);
    expect(isAllowedGithubUser("OTECH47", ["otech47"])).toBe(true);
    expect(isAllowedGithubUser("mallory", ["otech47"])).toBe(false);
    expect(isAllowedGithubUser(null, ["otech47"])).toBe(false);
    expect(isAllowedGithubUser("anyone", [])).toBe(false);
  });
});
