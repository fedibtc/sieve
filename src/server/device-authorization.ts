import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "./db/client";
import { deviceCode } from "./db/schema";

export type DeviceDecision = "approved" | "denied";

export function normalizeUserCode(value: string) {
  return value.replaceAll("-", "").replaceAll(/\s/g, "").toUpperCase();
}

export async function getDeviceAuthorization(userCode: string) {
  const normalized = normalizeUserCode(userCode);
  if (!normalized) {
    return null;
  }
  const db = await getDb();
  const [record] = await db
    .select()
    .from(deviceCode)
    .where(eq(deviceCode.userCode, normalized))
    .limit(1);
  return record ?? null;
}

export async function decideDeviceAuthorization(input: {
  userCode: string;
  userId: string;
  decision: DeviceDecision;
}) {
  const record = await getDeviceAuthorization(input.userCode);
  if (!record) {
    throw new Error("The device code is invalid.");
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new Error("The device code has expired.");
  }
  if (record.status !== "pending") {
    throw new Error("The device code has already been processed.");
  }
  if (record.userId && record.userId !== input.userId) {
    throw new Error("The device code belongs to another user.");
  }

  const db = await getDb();
  const [updated] = await db
    .update(deviceCode)
    .set({
      status: input.decision,
      userId: input.userId,
    })
    .where(
      and(
        eq(deviceCode.id, record.id),
        eq(deviceCode.status, "pending"),
        or(isNull(deviceCode.userId), eq(deviceCode.userId, input.userId)),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("The device code has already been processed.");
  }
  return updated;
}
