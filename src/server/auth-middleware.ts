import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { getLoginURL } from "./auth-redirect";
import { getDb } from "./db/client";
import { account, user } from "./db/schema";
import { isAllowedGithubUser } from "./env";
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

export async function getSession(requestHeaders?: Headers) {
  const auth = await getAuth();
  return auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
}

// Existing linked accounts without a backfilled login remain authorized until
// their next sign-in. Once populated, allowlist removal takes effect here for
// both sessions and API keys on their next request.
export async function isAuthorizedUser(sessionUser: {
  id: string;
  email: string;
}) {
  const db = await getDb();
  const [linked] = await db
    .select({
      id: account.id,
      githubLogin: user.githubLogin,
    })
    .from(account)
    .innerJoin(user, eq(user.id, account.userId))
    .where(
      and(eq(account.userId, sessionUser.id), eq(account.providerId, "github")),
    )
    .limit(1);
  if (!linked) {
    return false;
  }
  return linked.githubLogin ? isAllowedGithubUser(linked.githubLogin) : true;
}

export async function getAuthorizedSession(requestHeaders: Headers) {
  if (/^Bearer\s+.+/i.test(requestHeaders.get("authorization") ?? "")) {
    const auth = await getAuth();
    const bearerSession = await auth.api.getSession({
      headers: requestHeaders,
    });
    const isLocalDevUser =
      bearerSession?.user.id === "local-dev-user" && !process.env.VERCEL;
    if (
      !bearerSession?.user ||
      (!isLocalDevUser && !(await isAuthorizedUser(bearerSession.user)))
    ) {
      return null;
    }
    return bearerSession;
  }

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

  const session = await getSession(requestHeaders);
  if (!session?.user || !(await isAuthorizedUser(session.user))) {
    return null;
  }
  return session;
}

export async function requireSession(returnTo?: string) {
  const session = await getAuthorizedSession(await headers());
  if (!session) {
    redirect(getLoginURL(returnTo));
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
  if (!owner || (!isLocalDevOwner && !(await isAuthorizedUser(owner)))) {
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
  if (!session?.user || !(await isAuthorizedUser(session.user))) {
    return null;
  }

  return { user: await ensureUser(session.user), apiKey: null };
}
