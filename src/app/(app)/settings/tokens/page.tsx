import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { TokenSettings } from "@/components/tokens/token-settings";
import { requireSession } from "@/server/auth-middleware";
import { getDb } from "@/server/db/client";
import { apikey } from "@/server/db/schema";
import { ensureUser } from "@/server/services/users";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
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

  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host") ?? "localhost:7919";

  return (
    <TokenSettings
      baseUrl={`${protocol}://${host}`}
      initialTokens={tokens.map((token) => ({
        ...token,
        lastRequest: token.lastRequest?.toISOString() ?? null,
        expiresAt: token.expiresAt?.toISOString() ?? null,
        createdAt: token.createdAt.toISOString(),
      }))}
    />
  );
}
