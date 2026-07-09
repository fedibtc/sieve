import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { agentSessions } from "@/server/db/schema";
import { recordEvent } from "./events";

export async function registerAgentSession(input: {
  userId: string;
  reviewId?: string | null;
  repo: string;
  branch: string;
  agentKind: "claude-code" | "codex" | "other";
  hostname: string;
  workspacePath: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.userId, input.userId),
        eq(agentSessions.repo, input.repo),
        eq(agentSessions.branch, input.branch),
        eq(agentSessions.workspacePath, input.workspacePath),
        eq(agentSessions.status, "active"),
      ),
    )
    .limit(1);

  const values = {
    reviewId: input.reviewId ?? null,
    repo: input.repo,
    branch: input.branch,
    agentKind: input.agentKind,
    hostname: input.hostname,
    workspacePath: input.workspacePath,
    status: "active" as const,
    lastSeenAt: now,
    metadata: input.metadata ?? {},
    updatedAt: now,
  };

  const [session] = existing
    ? await db
        .update(agentSessions)
        .set(values)
        .where(eq(agentSessions.id, existing.id))
        .returning()
    : await db
        .insert(agentSessions)
        .values({ ...values, userId: input.userId })
        .returning();

  await recordEvent({
    reviewId: input.reviewId ?? null,
    type: "session.registered",
    message: "Agent session registered",
    payload: {
      sessionId: session.id,
      repo: input.repo,
      branch: input.branch,
      agentKind: input.agentKind,
      workspacePath: input.workspacePath,
    },
    createdBy: "agent",
    actorUserId: input.userId,
  });

  return session;
}

export async function endAgentSession(input: {
  userId: string;
  sessionId: string;
}) {
  const db = await getDb();
  const now = new Date();
  const [session] = await db
    .update(agentSessions)
    .set({ status: "ended", lastSeenAt: now, updatedAt: now })
    .where(
      and(
        eq(agentSessions.id, input.sessionId),
        eq(agentSessions.userId, input.userId),
      ),
    )
    .returning();

  if (!session) {
    throw new Error("Agent session not found");
  }

  return session;
}
