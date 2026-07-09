import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";

type EventType = typeof events.$inferInsert.type;

export async function recordEvent(input: {
  reviewId?: string | null;
  type: EventType;
  message: string;
  payload?: unknown;
  createdBy: "human" | "agent" | "system";
  actorUserId?: string | null;
}) {
  const db = await getDb();
  const [event] = await db
    .insert(events)
    .values({
      reviewId: input.reviewId ?? null,
      type: input.type,
      message: input.message,
      payload: input.payload ?? {},
      createdBy: input.createdBy,
      actorUserId: input.actorUserId ?? null,
    })
    .returning();
  return event;
}

export async function listReviewEvents(reviewId: string) {
  const db = await getDb();
  return db
    .select()
    .from(events)
    .where(eq(events.reviewId, reviewId))
    .orderBy(desc(events.createdAt));
}
