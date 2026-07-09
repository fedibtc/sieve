import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth-middleware";
import { getReview, updateReviewStatus } from "@/server/services/reviews";
import { ensureUser } from "@/server/services/users";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  await ensureUser(session.user);
  const { id } = await params;
  const review = await getReview(id);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  return NextResponse.json({ review });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const user = await ensureUser(session.user);
  const body = (await request.json()) as {
    status?: "open" | "approved" | "changes_requested" | "archived";
  };
  if (!body.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const { id } = await params;
  const review = await updateReviewStatus({
    reviewId: id,
    status: body.status,
    actorUserId: user.id,
    actor: "human",
  });
  return NextResponse.json({ review });
}
