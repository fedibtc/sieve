import { beforeEach, describe, expect, it } from "vitest";
import { authorizeGithubProfile } from "./auth";
import {
  resetGithubApprovalsForTests,
  takeGithubApproval,
} from "./github-login-gate";

describe("GitHub profile authorization", () => {
  beforeEach(() => {
    process.env.AUTH_ALLOWED_GITHUB_USERS = "allowed-user";
    resetGithubApprovalsForTests();
  });

  it("admits an allowlisted GitHub user to the creation gate", () => {
    expect(
      authorizeGithubProfile({
        login: "ALLOWED-USER",
        email: "allowed@example.com",
      }),
    ).toEqual({});
    expect(takeGithubApproval("allowed@example.com")).toBe(true);
  });

  it("rejects a non-allowlisted GitHub user", () => {
    expect(() =>
      authorizeGithubProfile({
        login: "unlisted-user",
        email: "unlisted@example.com",
      }),
    ).toThrow("GitHub account is not allowlisted");
    expect(takeGithubApproval("unlisted@example.com")).toBe(false);
  });
});
