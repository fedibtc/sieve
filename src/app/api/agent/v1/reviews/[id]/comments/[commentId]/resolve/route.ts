import { parseJson, withAgentAuth } from "@/server/agent/http";
import { resolveInput } from "@/server/agent/schemas";
import { resolveComment } from "@/server/services/comments";

export const dynamic = "force-dynamic";

const bodySchema = resolveInput.pick({ message: true }).partial();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  return withAgentAuth(request, async ({ user }) => {
    const { id, commentId } = await params;
    const input = await parseJson(request, bodySchema);
    return {
      comment: await resolveComment({
        reviewId: id,
        commentId,
        actorUserId: user.id,
        actor: "agent",
        resolved: true,
        replyMessage: input.message,
      }),
    };
  });
}
