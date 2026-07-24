import { defaultKeyHasher } from "@better-auth/api-key";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAuthForTests } from "./auth";
import { requireBearerUser } from "./auth-middleware";
import { getDb, resetDbForTests } from "./db/client";
import { account, apikey } from "./db/schema";
import { ensureUser } from "./services/users";

describe("bearer api-key auth", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://auth-${crypto.randomUUID()}`;
    resetDbForTests();
    resetAuthForTests();
  });

  it("accepts a valid enabled bearer token", async () => {
    const token = await createApiKey({ id: "valid-key" });

    const auth = await requireBearerUser(requestWithToken(token));

    expect(auth?.user.id).toBe("agent");
    expect(auth?.apiKey.id).toBe("valid-key");
  });

  it("rejects a bearer key whose owner has no linked GitHub account", async () => {
    const token = await createApiKey({
      id: "deauthorized-key",
      linkedGithub: false,
    });

    await expect(requireBearerUser(requestWithToken(token))).resolves.toBe(
      null,
    );
  });

  it("rejects garbage, expired, and disabled bearer tokens", async () => {
    await createApiKey({
      id: "expired-key",
      token: "sieve_expired",
      expiresAt: new Date(Date.now() - 1000),
    });
    await createApiKey({
      id: "disabled-key",
      token: "sieve_disabled",
      enabled: false,
    });

    await expect(
      requireBearerUser(requestWithToken("not-a-key")),
    ).resolves.toBe(null);
    await expect(
      requireBearerUser(requestWithToken("sieve_expired")),
    ).resolves.toBe(null);
    await expect(
      requireBearerUser(requestWithToken("sieve_disabled")),
    ).resolves.toBe(null);
  });
});

async function createApiKey(input: {
  id: string;
  token?: string;
  enabled?: boolean;
  expiresAt?: Date;
  linkedGithub?: boolean;
}) {
  const token = input.token ?? "sieve_valid";
  await ensureUser({
    id: "agent",
    name: "Agent",
    email: "agent@localhost",
    emailVerified: true,
  });
  const db = await getDb();
  if (input.linkedGithub ?? true) {
    await db.insert(account).values({
      id: `${input.id}-github`,
      accountId: "agent-github",
      providerId: "github",
      userId: "agent",
    });
  }
  await db.insert(apikey).values({
    id: input.id,
    name: input.id,
    start: token.slice(0, 12),
    prefix: "sieve_",
    key: await defaultKeyHasher(token),
    referenceId: "agent",
    enabled: input.enabled ?? true,
    rateLimitEnabled: false,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60),
  });
  resetAuthForTests();
  return token;
}

function requestWithToken(token: string) {
  return new Request("http://localhost/api/mcp", {
    headers: { authorization: `Bearer ${token}` },
  });
}
