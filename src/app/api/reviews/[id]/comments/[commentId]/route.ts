import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth-middleware";
import { resolveComment } from "@/server/services/comments";
import { ensureUser } from "@/server/services/users";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await requireSession();
  const user = await ensureUser(session.user);
  const body = (await request.json()) as { status?: "open" | "resolved" };
  if (body.status !== "open" && body.status !== "resolved") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { id, commentId } = await params;
  const comment = await resolveComment({
    reviewId: id,
    commentId,
    actorUserId: user.id,
    resolved: body.status === "resolved",
  });
  return NextResponse.json({ comment });
}
