import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/server/db/client";
import { endAgentSession, registerAgentSession } from "./agent-sessions";
import { ensureUser } from "./users";

describe("agent sessions", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://sessions-${crypto.randomUUID()}`;
    resetDbForTests();
  });

  it("registers, refreshes, and ends a workspace session", async () => {
    const user = await ensureUser({
      id: "agent",
      name: "Agent",
      email: "agent@localhost",
      emailVerified: true,
    });

    const first = await registerAgentSession({
      userId: user.id,
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      agentKind: "codex",
      hostname: "localhost",
      workspacePath: "/tmp/credential-app",
      metadata: { pid: 123 },
    });
    const refreshed = await registerAgentSession({
      userId: user.id,
      repo: "fedibtc/credential-app",
      branch: "codex/test",
      agentKind: "codex",
      hostname: "localhost",
      workspacePath: "/tmp/credential-app",
      metadata: { pid: 456 },
    });

    expect(refreshed.id).toBe(first.id);
    expect(refreshed.metadata).toEqual({ pid: 456 });

    const ended = await endAgentSession({
      userId: user.id,
      sessionId: first.id,
    });
    expect(ended.status).toBe("ended");
  });
});
