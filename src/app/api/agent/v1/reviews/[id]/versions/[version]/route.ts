import { withAgentAuth } from "@/server/agent/http";
import { getReviewRunForVersion } from "@/server/services/review-runs";
import { getReviewVersion } from "@/server/services/reviews";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  return withAgentAuth(request, async () => {
    const { id, version } = await params;
    const parsed = Number(version);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error("version must be a positive integer");
    }
    const record = await getReviewVersion(id, parsed);
    if (!record) {
      throw new Error("Review version not found");
    }
    return {
      version: record,
      run: await getReviewRunForVersion(id, parsed),
    };
  });
}
