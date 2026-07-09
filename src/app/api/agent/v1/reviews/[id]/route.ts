import { baseUrlFromRequest, withAgentAuth } from "@/server/agent/http";
import { getReview } from "@/server/services/reviews";

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
      review,
      url: `${baseUrlFromRequest(request)}/reviews/${review.id}`,
    };
  });
}
