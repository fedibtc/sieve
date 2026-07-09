import { defaultKeyHasher } from "@better-auth/api-key";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth";
import { getDb, resetDbForTests } from "@/server/db/client";
import { apikey } from "@/server/db/schema";
import { ensureUser } from "@/server/services/users";
import { POST as replyToComment } from "./reviews/[id]/comments/[commentId]/replies/route";
import { POST as resolveComment } from "./reviews/[id]/comments/[commentId]/resolve/route";
import { POST as addComment } from "./reviews/[id]/comments/route";
import { POST as consumeFeedback } from "./reviews/[id]/feedback/consume/route";
import { GET as getFeedback } from "./reviews/[id]/feedback/route";
import { GET as getReview } from "./reviews/[id]/route";
import { POST as updateStatus } from "./reviews/[id]/status/route";
import { GET as listReviews, POST as publishReview } from "./reviews/route";
import { POST as endSession } from "./sessions/[id]/end/route";
import { POST as registerSession } from "./sessions/route";
import { GET as whoami } from "./whoami/route";

describe("agent REST routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `pglite:memory://agent-routes-${crypto.randomUUID()}`;
    process.env.AUTH_ALLOWED_DOMAINS = "localhost";
    delete process.env.VERCEL;
    resetDbForTests();
    resetAuthForTests();
  });

  it("uses JSON auth errors and allows tokenless localhost", async () => {
    const unauthenticated = await whoami(
      new Request("https://reviews.example.com/api/agent/v1/whoami"),
    );
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({
      error: { code: "auth" },
    });

    const local = await whoami(agentRequest("/whoami"));
    expect(local.status).toBe(200);
    expect(await local.json()).toMatchObject({
      user: { id: "local-dev-user", email: "local-dev@localhost" },
      tokenExpiresAt: null,
    });
  });

  it("accepts valid bearer auth outside localhost", async () => {
    const token = await createApiKey();
    const response = await whoami(
      new Request("https://reviews.example.com/api/agent/v1/whoami", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: "agent", email: "agent@localhost" },
    });
  });

  it("rejects invalid bearer auth and disables localhost bypass on Vercel", async () => {
    await createApiKey({
      id: "expired-route-key",
      token: "sieve_expired_route",
      expiresAt: new Date(Date.now() - 1000),
    });
    await createApiKey({
      id: "disabled-route-key",
      token: "sieve_disabled_route",
      enabled: false,
    });

    for (const token of [
      "not-a-key",
      "sieve_expired_route",
      "sieve_disabled_route",
    ]) {
      const response = await whoami(
        new Request("https://reviews.example.com/api/agent/v1/whoami", {
          headers: { authorization: `Bearer ${token}` },
        }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: { code: "auth" },
      });
    }

    process.env.VERCEL = "1";
    resetAuthForTests();
    const localOnVercel = await whoami(agentRequest("/whoami"));
    expect(localOnVercel.status).toBe(401);
    expect(await localOnVercel.json()).toMatchObject({
      error: { code: "auth" },
    });
  });

  it("publishes, lists, fetches, comments, resolves, consumes, and archives", async () => {
    const published = await publishReview(
      agentRequest("/reviews", {
        method: "POST",
        body: JSON.stringify(reviewPayload()),
      }),
    );
    expect(published.status).toBe(200);
    const { review, url } = await published.json();
    expect(review.id).toBeTruthy();
    expect(url).toBe(`http://localhost/reviews/${review.id}`);

    const listed = await listReviews(agentRequest("/reviews?repo=credential"));
    expect(listed.status).toBe(200);
    expect((await listed.json()).reviews).toHaveLength(1);

    const fetched = await getReview(agentRequest(`/reviews/${review.id}`), {
      params: Promise.resolve({ id: review.id }),
    });
    expect(fetched.status).toBe(200);
    expect((await fetched.json()).review.title).toBe("Agent route recap");

    const comment = await addComment(
      agentRequest(`/reviews/${review.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          message: "Agent note",
          resolutionTarget: "agent",
        }),
      }),
      { params: Promise.resolve({ id: review.id }) },
    );
    expect(comment.status).toBe(200);
    const commentId = (await comment.json()).comment.id;

    const reply = await replyToComment(
      agentRequest(`/reviews/${review.id}/comments/${commentId}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: "Fixed in v2" }),
      }),
      { params: Promise.resolve({ id: review.id, commentId }) },
    );
    expect(reply.status).toBe(200);

    const resolved = await resolveComment(
      agentRequest(`/reviews/${review.id}/comments/${commentId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ message: "Resolving after validation" }),
      }),
      { params: Promise.resolve({ id: review.id, commentId }) },
    );
    expect(resolved.status).toBe(200);

    const feedback = await getFeedback(
      agentRequest(`/reviews/${review.id}/feedback`),
      { params: Promise.resolve({ id: review.id }) },
    );
    expect(feedback.status).toBe(200);

    const consumed = await consumeFeedback(
      agentRequest(`/reviews/${review.id}/feedback/consume`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: review.id }) },
    );
    expect(consumed.status).toBe(200);

    const archived = await updateStatus(
      agentRequest(`/reviews/${review.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "archived" }),
      }),
      { params: Promise.resolve({ id: review.id }) },
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).review.status).toBe("archived");

    const approved = await updateStatus(
      agentRequest(`/reviews/${review.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: Promise.resolve({ id: review.id }) },
    );
    expect(approved.status).toBe(400);
    expect(await approved.json()).toMatchObject({
      error: { code: "validation" },
    });

    const changesRequested = await updateStatus(
      agentRequest(`/reviews/${review.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "changes_requested" }),
      }),
      { params: Promise.resolve({ id: review.id }) },
    );
    expect(changesRequested.status).toBe(400);
    expect(await changesRequested.json()).toMatchObject({
      error: { code: "validation" },
    });
  });

  it("registers and ends agent sessions", async () => {
    const registered = await registerSession(
      agentRequest("/sessions", {
        method: "POST",
        body: JSON.stringify({
          repo: "fedibtc/credential-app",
          branch: "codex/demo",
          agentKind: "codex",
          hostname: "workstation",
          workspacePath: "/tmp/credential-app",
        }),
      }),
    );
    expect(registered.status).toBe(200);
    const sessionId = (await registered.json()).session.id;

    const ended = await endSession(agentRequest(`/sessions/${sessionId}/end`), {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(ended.status).toBe(200);
    expect((await ended.json()).session.status).toBe("ended");
  });

  it("returns JSON validation errors", async () => {
    const response = await publishReview(
      agentRequest("/reviews", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "validation" },
    });
  });
});

async function createApiKey(input?: {
  id?: string;
  token?: string;
  enabled?: boolean;
  expiresAt?: Date;
}) {
  const token = input?.token ?? "sieve_agent_route_valid";
  const user = await ensureUser({
    id: "agent",
    name: "Agent",
    email: "agent@localhost",
    emailVerified: true,
  });
  const db = await getDb();
  await db.insert(apikey).values({
    id: input?.id ?? "agent-route-key",
    name: "Agent route key",
    start: token.slice(0, 12),
    prefix: "sieve_",
    key: await defaultKeyHasher(token),
    referenceId: user.id,
    enabled: input?.enabled ?? true,
    rateLimitEnabled: false,
    expiresAt: input?.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60),
  });
  resetAuthForTests();
  return token;
}

function agentRequest(path: string, init?: RequestInit) {
  return new Request(`http://localhost/api/agent/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      host: "localhost",
      ...init?.headers,
    },
  });
}

function reviewPayload() {
  return {
    title: "Agent route recap",
    repo: "fedibtc/credential-app",
    branch: "codex/demo",
    idempotencyKey: "fedibtc/credential-app#codex/demo",
    content: {
      version: 1,
      blocks: [
        {
          id: "summary",
          type: "rich-text",
          data: { markdown: "## Outcome\nAgent route smoke test." },
        },
      ],
    },
  };
}
