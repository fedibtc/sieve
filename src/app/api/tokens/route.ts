import { defaultKeyHasher } from "@better-auth/api-key";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/server/auth";
import { requireSession } from "@/server/auth-middleware";
import { getDb } from "@/server/db/client";
import { apikey } from "@/server/db/schema";
import { ensureUser } from "@/server/services/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  const user = await ensureUser(session.user);
  const db = await getDb();
  const tokens = await db
    .select({
      id: apikey.id,
      name: apikey.name,
      start: apikey.start,
      prefix: apikey.prefix,
      enabled: apikey.enabled,
      lastRequest: apikey.lastRequest,
      expiresAt: apikey.expiresAt,
      createdAt: apikey.createdAt,
    })
    .from(apikey)
    .where(eq(apikey.referenceId, user.id))
    .orderBy(desc(apikey.createdAt));

  return NextResponse.json({ tokens });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const user = await ensureUser(session.user);
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
  };
  const auth = await getAuth();
  const name = body.name?.trim() || "Agent token";
  const requestHeaders = await headers();
  const token = await auth.api
    .createApiKey({
      headers: requestHeaders,
      body: {
        name,
        userId: user.id,
        prefix: "sieve_",
      },
    })
    .catch((error: unknown) => {
      if (user.id !== "local-dev-user" || process.env.VERCEL) {
        throw error;
      }
      return createLocalBypassApiKey({ name, userId: user.id });
    });

  return NextResponse.json({ token }, { status: 201 });
}

async function createLocalBypassApiKey(input: {
  name: string;
  userId: string;
}) {
  const key = `sieve_${nanoid(64)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90);
  const db = await getDb();
  const [token] = await db
    .insert(apikey)
    .values({
      id: nanoid(12),
      configId: "default",
      name: input.name,
      start: key.slice(0, 6),
      prefix: "sieve_",
      key: await defaultKeyHasher(key),
      referenceId: input.userId,
      enabled: true,
      rateLimitEnabled: false,
      rateLimitTimeWindow: null,
      rateLimitMax: null,
      requestCount: 0,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return { ...token, key };
}
