import { withAgentAuth } from "@/server/agent/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAgentAuth(request, async ({ user, apiKey }) => ({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tokenExpiresAt: apiKey?.expiresAt ?? null,
  }));
}
