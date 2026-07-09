import { parseJson, withAgentAuth } from "@/server/agent/http";
import { sessionInput } from "@/server/agent/schemas";
import { registerAgentSession } from "@/server/services/agent-sessions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withAgentAuth(request, async ({ user }) => {
    const input = await parseJson(request, sessionInput);
    return {
      session: await registerAgentSession({
        ...input,
        userId: user.id,
      }),
    };
  });
}
