import { withAgentAuth } from "@/server/agent/http";
import { getReview, listReviewVersions } from "@/server/services/reviews";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentAuth(request, async () => {
    const { id } = await params;
    const review = await getReview(id);
    if (!review) {
      throw new Error("Review not found");
    }
    return {
      reviewId: review.id,
      contentVersion: review.contentVersion,
      versions: await listReviewVersions(id),
    };
  });
}
