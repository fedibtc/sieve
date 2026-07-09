import { withAgentAuth } from "@/server/agent/http";
import { endAgentSession } from "@/server/services/agent-sessions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async ({ user }) => {
    const { id } = await params;
    return {
      session: await endAgentSession({ sessionId: id, userId: user.id }),
    };
  });
}
