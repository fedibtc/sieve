import { parseJson, withAgentAuth } from "@/server/agent/http";
import { commentInput } from "@/server/agent/schemas";
import { createComment } from "@/server/services/comments";

export const dynamic = "force-dynamic";

const bodySchema = commentInput.omit({ reviewId: true });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async ({ user }) => {
    const { id } = await params;
    const input = await parseJson(request, bodySchema);
    return {
      comment: await createComment({
        reviewId: id,
        authorUserId: user.id,
        createdBy: "agent",
        message: input.message,
        anchor: input.anchor ?? null,
        resolutionTarget: input.resolutionTarget,
      }),
    };
  });
}
