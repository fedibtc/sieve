import { withAgentAuth } from "@/server/agent/http";
import { getReviewRun } from "@/server/services/review-runs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async () => {
    const { id } = await params;
    const run = await getReviewRun(id);
    if (!run) {
      throw new Error("Run not found");
    }
    return { run };
  });
}
