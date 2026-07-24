import { describe, expect, it } from "vitest";
import { getAllowedGithubUsers, isAllowedGithubUser } from "./env";

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
