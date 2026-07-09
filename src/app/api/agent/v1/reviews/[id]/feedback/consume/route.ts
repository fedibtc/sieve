import { parseJson, withAgentAuth } from "@/server/agent/http";
import { consumeFeedbackInput } from "@/server/agent/schemas";
import { consumeFeedback } from "@/server/services/comments";

export const dynamic = "force-dynamic";

const bodySchema = consumeFeedbackInput.pick({ commentIds: true }).partial();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async ({ user }) => {
    const { id } = await params;
    const input = await parseJson(request, bodySchema);
    return {
      consumed: await consumeFeedback(id, user.id, input.commentIds),
    };
  });
}
