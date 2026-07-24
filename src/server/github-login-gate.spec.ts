import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveGithubEmail,
  resetGithubApprovalsForTests,
  takeGithubApproval,
} from "./github-login-gate";

describe("github login gate", () => {
  beforeEach(() => {
    resetGithubApprovalsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("consumes an approval exactly once, case-insensitively", () => {
    approveGithubEmail("Dev@Example.com", "GitHubUser");

    expect(takeGithubApproval("dev@example.com")).toBe("githubuser");
    expect(takeGithubApproval("dev@example.com")).toBeNull();
  });

  it("rejects unapproved and missing emails", () => {
    expect(takeGithubApproval("nobody@example.com")).toBeNull();
    expect(takeGithubApproval(null)).toBeNull();
    approveGithubEmail(null, "github-user");
    approveGithubEmail("dev@example.com", null);
    expect(takeGithubApproval(null)).toBeNull();
  });

  it("expires approvals after the ttl", () => {
    vi.useFakeTimers();
    approveGithubEmail("dev@example.com", "github-user");

    vi.advanceTimersByTime(61_000);

    expect(takeGithubApproval("dev@example.com")).toBeNull();
  });
});
