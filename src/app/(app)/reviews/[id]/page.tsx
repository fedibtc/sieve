import { notFound } from "next/navigation";
import { ReviewDetail } from "@/components/blocks/review-detail";
import { requireSession } from "@/server/auth-middleware";
import { listCommentThreads } from "@/server/services/comments";
import { getReview } from "@/server/services/reviews";
import { ensureUser } from "@/server/services/users";
import { reviewDocumentSchema } from "@/shared/blocks";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  await ensureUser(session.user);
  const { id } = await params;
  const review = await getReview(id);
  if (!review) {
    notFound();
  }

  const parsedReview = {
    ...review,
    content: reviewDocumentSchema.parse(review.content),
  };
  const threads = await listCommentThreads(id);

  return (
    <ReviewDetail
      initialReview={JSON.parse(JSON.stringify(parsedReview))}
      initialThreads={JSON.parse(JSON.stringify(threads))}
    />
  );
}
