import { parseJson, withAgentAuth } from "@/server/agent/http";
import { statusInput } from "@/server/agent/schemas";
import { updateReviewStatus } from "@/server/services/reviews";

export const dynamic = "force-dynamic";

const bodySchema = statusInput.pick({ status: true });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async ({ user }) => {
    const { id } = await params;
    const input = await parseJson(request, bodySchema);
    return {
      review: await updateReviewStatus({
        reviewId: id,
        status: input.status,
        actorUserId: user.id,
        actor: "agent",
      }),
    };
  });
}
