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
    approveGithubEmail("Dev@Example.com");

    expect(takeGithubApproval("dev@example.com")).toBe(true);
    expect(takeGithubApproval("dev@example.com")).toBe(false);
  });

  it("rejects unapproved and missing emails", () => {
    expect(takeGithubApproval("nobody@example.com")).toBe(false);
    expect(takeGithubApproval(null)).toBe(false);
    approveGithubEmail(null);
    expect(takeGithubApproval(null)).toBe(false);
  });

  it("expires approvals after the ttl", () => {
    vi.useFakeTimers();
    approveGithubEmail("dev@example.com");

    vi.advanceTimersByTime(61_000);

    expect(takeGithubApproval("dev@example.com")).toBe(false);
  });
});
