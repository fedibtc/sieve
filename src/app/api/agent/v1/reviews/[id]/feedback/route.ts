import { withAgentAuth } from "@/server/agent/http";
import { getFeedbackPartition } from "@/server/services/comments";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async () => {
    const { id } = await params;
    return getFeedbackPartition(id);
  });
}
