import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "./db/client";
import * as schema from "./db/schema";
import { getAllowedDomains, isAllowedEmailDomain } from "./env";

const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? "missing-google-client-id";
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? "missing-google-client-secret";

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
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        prompt: "select_account",
        hd: getAllowedDomains()[0],
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!user.emailVerified || !isAllowedEmailDomain(user.email)) {
              return false;
            }
            return { data: user };
          },
        },
      },
    },
    plugins: [
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

export type Auth = Awaited<ReturnType<typeof getAuth>>;
export type AuthSession = Awaited<ReturnType<Auth["api"]["getSession"]>>;
