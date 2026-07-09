import { parseJson, withAgentAuth } from "@/server/agent/http";
import { replyInput } from "@/server/agent/schemas";
import { createComment } from "@/server/services/comments";

export const dynamic = "force-dynamic";

const bodySchema = replyInput.pick({ message: true });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  return withAgentAuth(request, async ({ user }) => {
    const { id, commentId } = await params;
    const input = await parseJson(request, bodySchema);
    return {
      comment: await createComment({
        reviewId: id,
        authorUserId: user.id,
        createdBy: "agent",
        message: input.message,
        parentCommentId: commentId,
        resolutionTarget: "agent",
      }),
    };
  });
}
