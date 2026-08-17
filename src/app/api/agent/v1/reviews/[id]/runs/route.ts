import { withAgentAuth } from "@/server/agent/http";
import { listReviewRuns } from "@/server/services/review-runs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async () => {
    const { id } = await params;
    return { runs: await listReviewRuns({ reviewId: id }) };
  });
}
