import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { getDb } from "./db/client";
import { user } from "./db/schema";
import { isAllowedEmailDomain } from "./env";
import { ensureUser } from "./services/users";

const localDevUser = {
  id: "local-dev-user",
  name: "Local Dev",
  email: "local-dev@localhost",
  emailVerified: true,
  image: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export async function getSession() {
  const auth = await getAuth();
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const requestHeaders = await headers();
  if (isLocalhostBypassEnabled(requestHeaders)) {
    return {
      user: localDevUser,
      session: {
        id: "local-dev-session",
        token: "local-dev-session",
        userId: localDevUser.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    };
  }

  const session = await getSession();
  if (!session?.user || !isAllowedEmailDomain(session.user.email)) {
    redirect("/login");
  }
  return session;
}

function isLocalhostBypassEnabled(requestHeaders: Headers) {
  if (process.env.VERCEL) {
    return false;
  }

  const host = requestHeaders.get("host")?.split(":")[0]?.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export async function verifyBearer(request: Request) {
  const auth = await getAuth();
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return null;
  }

  const result = await auth.api.verifyApiKey({
    body: { key: token },
  });

  if (!result.valid) {
    return null;
  }

  return result;
}

export async function requireBearerUser(request: Request) {
  const result = await verifyBearer(request);
  if (!result?.valid || !result.key?.referenceId) {
    return null;
  }

  const db = await getDb();
  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.id, result.key.referenceId))
    .limit(1);

  const isLocalDevOwner = owner?.id === "local-dev-user" && !process.env.VERCEL;
  if (!owner || (!isLocalDevOwner && !isAllowedEmailDomain(owner.email))) {
    return null;
  }

  return { user: owner, apiKey: result.key };
}

export async function authenticateRequest(request: Request) {
  const hasBearer = /^Bearer\s+.+/i.test(
    request.headers.get("authorization") ?? "",
  );
  const bearer = await requireBearerUser(request);
  if (bearer) {
    return { user: bearer.user, apiKey: bearer.apiKey };
  }
  if (hasBearer) {
    return null;
  }

  if (isLocalhostBypassEnabled(request.headers)) {
    return { user: await ensureUser(localDevUser), apiKey: null };
  }

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user || !isAllowedEmailDomain(session.user.email)) {
    return null;
  }

  return { user: await ensureUser(session.user), apiKey: null };
}
