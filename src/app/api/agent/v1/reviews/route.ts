import {
  baseUrlFromRequest,
  parseJson,
  parseSearch,
  withAgentAuth,
} from "@/server/agent/http";
import { listReviewsInput, publishReviewInput } from "@/server/agent/schemas";
import { listReviews, upsertReview } from "@/server/services/reviews";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAgentAuth(request, async () => ({
    reviews: await listReviews(parseSearch(request, listReviewsInput)),
  }));
}

export async function POST(request: Request) {
  return withAgentAuth(request, async ({ user }) => {
    const input = await parseJson(request, publishReviewInput);
    const review = await upsertReview({
      ...input,
      createdByUserId: user.id,
    });
    return {
      review,
      url: `${baseUrlFromRequest(request)}/reviews/${review.id}`,
    };
  });
}
