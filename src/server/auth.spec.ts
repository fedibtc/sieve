import { beforeEach, describe, expect, it } from "vitest";
import { mapGithubProfileToUser, resetAuthForTests } from "./auth";
import { getDb, resetDbForTests } from "./db/client";
import { user } from "./db/schema";
import {
  resetGithubApprovalsForTests,
  takeGithubApproval,
} from "./github-login-gate";
import { ensureUser } from "./services/users";

describe("GitHub profile authorization", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://github-profile-${crypto.randomUUID()}`;
    process.env.AUTH_ALLOWED_GITHUB_USERS = "allowed-user";
    resetDbForTests();
    resetAuthForTests();
    resetGithubApprovalsForTests();
  });

  it("admits an allowlisted GitHub user to the creation gate", async () => {
    expect(
      await mapGithubProfileToUser({
        login: "ALLOWED-USER",
        email: "allowed@example.com",
      }),
    ).toEqual({});
    expect(takeGithubApproval("allowed@example.com")).toBe("allowed-user");
  });

  it("rejects a non-allowlisted GitHub user", async () => {
    await expect(
      mapGithubProfileToUser({
        login: "unlisted-user",
        email: "unlisted@example.com",
      }),
    ).rejects.toThrow("GitHub account is not allowlisted");
    expect(takeGithubApproval("unlisted@example.com")).toBeNull();
  });

  it("backfills the normalized login for an existing user", async () => {
    await ensureUser({
      id: "existing-user",
      name: "Existing",
      email: "existing@example.com",
      emailVerified: true,
    });

    await mapGithubProfileToUser({
      login: "Allowed-User",
      email: "existing@example.com",
    });

    const db = await getDb();
    const [updated] = await db.select().from(user);
    expect(updated.githubLogin).toBe("allowed-user");
  });
});
