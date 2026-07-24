import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import * as schema from "./db/schema";
import { isAllowedGithubUser } from "./env";
import { approveGithubEmail, takeGithubApproval } from "./github-login-gate";

const githubClientId =
  process.env.GITHUB_CLIENT_ID ?? "missing-github-client-id";
const githubClientSecret =
  process.env.GITHUB_CLIENT_SECRET ?? "missing-github-client-secret";

let authPromise: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  authPromise ??= createAuth();
  return authPromise;
}

export function resetAuthForTests() {
  authPromise = undefined;
}

async function createAuth() {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.BETTER_AUTH_SECRET
  ) {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }
  return betterAuth({
    appName: "sieve",
    database: drizzleAdapter(await getDb(), {
      provider: "pg",
      schema,
    }),
    secret:
      process.env.BETTER_AUTH_SECRET ??
      "dev-secret-change-me-dev-secret-change-me",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:7919",
    user: {
      additionalFields: {
        githubLogin: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    socialProviders: {
      github: {
        clientId: githubClientId,
        clientSecret: githubClientSecret,
        mapProfileToUser: mapGithubProfileToUser,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const githubLogin = takeGithubApproval(user.email);
            if (!user.emailVerified || !githubLogin) {
              return false;
            }
            return { data: { ...user, githubLogin } };
          },
        },
      },
    },
    plugins: [
      deviceAuthorization({
        verificationUri: "/device",
        expiresIn: "15m",
        interval: "5s",
        userCodeLength: 8,
        validateClient: (clientId) => clientId === "sieve-cli",
      }),
      bearer(),
      apiKey({
        defaultPrefix: "sieve_",
        keyExpiration: {
          defaultExpiresIn: 60 * 60 * 24 * 90,
          disableCustomExpiresTime: true,
        },
        rateLimit: {
          enabled: false,
        },
      }),
      nextCookies(),
    ],
  });
}

export function authorizeGithubProfile(profile: {
  login: string;
  email?: string | null;
}) {
  if (!isAllowedGithubUser(profile.login)) {
    throw new APIError("UNAUTHORIZED", {
      message: "GitHub account is not allowlisted",
    });
  }
  approveGithubEmail(profile.email, profile.login);
  return profile.login.toLowerCase();
}

export async function mapGithubProfileToUser(profile: {
  login: string;
  email?: string | null;
}) {
  const githubLogin = authorizeGithubProfile(profile);
  if (profile.email) {
    const db = await getDb();
    await db
      .update(schema.user)
      .set({ githubLogin, updatedAt: new Date() })
      .where(eq(schema.user.email, profile.email.toLowerCase()));
  }
  return {};
}

export type Auth = Awaited<ReturnType<typeof getAuth>>;
export type AuthSession = Awaited<ReturnType<Auth["api"]["getSession"]>>;
